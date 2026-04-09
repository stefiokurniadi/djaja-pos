import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { branchScopeForRole, requireSession } from "@/lib/rbac";
import { jsonError } from "@/lib/http";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.user.companyId) return jsonError(400, "Missing company");
    const scope = branchScopeForRole(session.user.role, session.user.branchId);

    const whereTx = {
      status: "COMPLETED" as const,
      branch: { companyId: session.user.companyId },
      ...(scope.branchId ? { branchId: scope.branchId } : {})
    };

    const txs = await prisma.transaction.findMany({
      where: whereTx,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        createdAt: true,
        paymentMethod: true,
        total: true,
        branch: { select: { name: true } },
        items: { select: { productName: true, quantity: true, unitCost: true, lineTotal: true } }
      }
    });

    const rows = txs.map((t) => {
      const cogs = t.items.reduce(
        (sum, it) => sum.add((it.unitCost as Prisma.Decimal).mul(it.quantity)),
        new Prisma.Decimal(0)
      );
      const profit = (t.total as Prisma.Decimal).sub(cogs);
      return {
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      branchName: t.branch?.name ?? "—",
      paymentMethod: t.paymentMethod,
      total: Number(t.total as Prisma.Decimal),
      items: t.items.map((it) => ({ name: it.productName, qty: it.quantity })),
      cogs: Number(cogs),
      profit: Number(profit)
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="transactions.xlsx"'
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to export");
  }
}

