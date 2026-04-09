import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

function parseDateParam(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId") || undefined;
    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));

    if (branchId) {
      const b = await prisma.branch.findFirst({
        where: { id: branchId, companyId: session.user.companyId }
      });
      if (!b) return jsonError(400, "Invalid branch");
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        status: "COMPLETED",
        branch: { companyId: session.user.companyId },
        ...(branchId ? { branchId } : {}),
        ...(from || to
          ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        branch: { select: { id: true, name: true } },
        items: true
      }
    });

    return Response.json({ transactions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    return jsonError(500, "Failed to fetch transactions");
  }
}

const CreateTransactionSchema = z.object({
  paymentMethod: z.enum(["CASH", "DIGITAL"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive()
      })
    )
    .min(1),
  receivedAmount: z.coerce.number().nonnegative().optional(),
  branchId: z.string().min(1).optional()
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const body = await req.json();
    const input = CreateTransactionSchema.parse(body);

    const branchId =
      session.user.role === "CASHIER" ? session.user.branchId : input.branchId;
    if (!branchId) return jsonError(400, "Branch is required");

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: session.user.companyId }
    });
    if (!branch) return jsonError(400, "Invalid branch");
    const productIds = input.items.map((i) => i.productId);

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        branchId
      },
      select: {
        id: true,
        name: true,
        price: true,
        costPrice: true
      }
    });

    const byId = new Map(products.map((p) => [p.id, p]));
    for (const it of input.items) {
      if (!byId.has(it.productId)) return jsonError(400, "Invalid product");
    }

    const lineItems = input.items.map((it) => {
      const p = byId.get(it.productId)!;
      const unitPrice = p.price;
      const unitCost = p.costPrice;
      const lineTotal = p.price.mul(it.quantity);
      return {
        productId: p.id,
        productName: p.name,
        quantity: it.quantity,
        unitPrice,
        unitCost,
        lineTotal
      };
    });

    const created = await prisma.$transaction(async (tx) => {
      const createdTx = await tx.transaction.create({
        data: {
          branchId,
          cashierUserId: session.user.id,
          paymentMethod: input.paymentMethod,
          subtotal: new Prisma.Decimal(0),
          discountAmount: 0,
          taxAmount: 0,
          total: new Prisma.Decimal(0),
          receivedAmount: input.receivedAmount ?? null,
          changeAmount: null,
          items: {
            create: lineItems.map((li) => ({
              productId: li.productId,
              productName: li.productName,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              unitCost: li.unitCost,
              lineTotal: li.lineTotal
            }))
          }
        },
        include: { items: true }
      });

      // Recompute totals from stored lineTotals (all Decimals)
      const agg = await tx.transactionItem.aggregate({
        where: { transactionId: createdTx.id },
        _sum: { lineTotal: true }
      });

      const computedSubtotal =
        agg._sum.lineTotal ?? new Prisma.Decimal(0);
      const computedTotal = computedSubtotal; // tax/discount later

      const changeAmount =
        input.paymentMethod === "CASH" && typeof input.receivedAmount === "number"
          ? new Prisma.Decimal(input.receivedAmount).sub(computedTotal)
          : null;

      const updated = await tx.transaction.update({
        where: { id: createdTx.id },
        data: {
          subtotal: computedSubtotal,
          total: computedTotal,
          changeAmount
        },
        include: { items: true }
      });

      return updated;
    });

    return Response.json({ transaction: created }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to create transaction");
  }
}

