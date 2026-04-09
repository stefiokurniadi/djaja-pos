import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { branchScopeForRole, requireSession } from "@/lib/rbac";

function parseDateParam(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.companyId) return jsonError(400, "Missing company");
    const scope = branchScopeForRole(session.user.role, session.user.branchId);

    const url = new URL(req.url);
    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));
    const requestedBranchId = url.searchParams.get("branchId") || undefined;

    const branchId =
      scope.branchId ?? requestedBranchId;

    const whereTx = {
      status: "COMPLETED" as const,
      branch: { companyId: session.user.companyId },
      ...(branchId ? { branchId } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {})
    };

    // If branchId is provided (owner/admin), ensure it belongs to the company.
    if (branchId) {
      const b = await prisma.branch.findFirst({
        where: { id: branchId, companyId: session.user.companyId }
      });
      if (!b) return jsonError(400, "Invalid branch");
    }

    const [salesAgg, topItems] = await Promise.all([
      prisma.transaction.aggregate({
        where: whereTx,
        _sum: { total: true },
        _count: { _all: true }
      }),
      prisma.transactionItem.groupBy({
        by: ["productName"],
        where: {
          transaction: whereTx
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10
      })
    ]);

    const totalRevenue = salesAgg._sum.total ?? new Prisma.Decimal(0);
    const orderCount = salesAgg._count._all ?? 0;

    // Compute total COGS from items: sum(unitCost * quantity)
    // Prisma can't aggregate unitCost*quantity directly, so do it in JS from grouped rows.
    const items = await prisma.transactionItem.findMany({
      where: { transaction: whereTx },
      select: { unitCost: true, quantity: true }
    });
    const totalCogs = items.reduce(
      (sum, it) => sum.add(it.unitCost.mul(it.quantity)),
      new Prisma.Decimal(0)
    );

    const totalProfit = totalRevenue.sub(totalCogs);

    return Response.json({
      totalRevenue,
      totalCogs,
      totalProfit,
      orderCount,
      topItems: topItems.map((t) => ({
        productName: t.productName,
        quantity: t._sum.quantity ?? 0,
        revenue: t._sum.lineTotal ?? new Prisma.Decimal(0)
      }))
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to load report");
  }
}

