import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { branchScopeForRole, requireSession } from "@/lib/rbac";
import { jsonError } from "@/lib/http";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const session = await requireSession();
    const scope = branchScopeForRole(session.user.role, session.user.branchId);

    const whereTx = {
      status: "COMPLETED" as const,
      ...(scope.branchId ? { branchId: scope.branchId } : {})
    };

    const txs = await prisma.transaction.findMany({
      where: whereTx,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, createdAt: true, paymentMethod: true, total: true }
    });

    const rows = txs.map((t) => ({
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      paymentMethod: t.paymentMethod,
      total: Number(t.total as Prisma.Decimal)
    }));

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

