import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { branchScopeForRole, requireSession } from "@/lib/rbac";

function parseDateParam(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Row = { date: string; revenue: number };

function toYMDUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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

    const branchId = scope.branchId ?? requestedBranchId;

    if (branchId) {
      const b = await prisma.branch.findFirst({
        where: { id: branchId, companyId: session.user.companyId }
      });
      if (!b) return jsonError(400, "Invalid branch");
    }

    // Daily revenue (UTC) using raw SQL for date grouping.
    // IMPORTANT: must be company-scoped to avoid cross-tenant data leaks.
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        to_char(date_trunc('day', "Transaction"."createdAt"), 'YYYY-MM-DD') as "date",
        COALESCE(SUM("Transaction"."total"), 0)::float8 as "revenue"
      FROM "Transaction"
      JOIN "Branch" ON "Branch"."id" = "Transaction"."branchId"
      WHERE "status" = 'COMPLETED'
        AND "Branch"."companyId" = ${session.user.companyId}
        AND (${branchId ? Prisma.sql`"branchId" = ${branchId}` : Prisma.sql`TRUE`})
        AND (${from ? Prisma.sql`"Transaction"."createdAt" >= ${from}` : Prisma.sql`TRUE`})
        AND (${to ? Prisma.sql`"Transaction"."createdAt" <= ${to}` : Prisma.sql`TRUE`})
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    if (!from || !to) return Response.json({ points: rows });

    // Ensure the X-axis is complete (all dates in range), filling missing days with 0 revenue.
    const start = startOfDayUTC(from);
    const end = startOfDayUTC(to);
    const byDate = new Map(rows.map((r) => [r.date, r.revenue]));
    const points: Row[] = [];

    for (let cur = start; cur.getTime() <= end.getTime(); cur = new Date(cur.getTime() + 86_400_000)) {
      const date = toYMDUTC(cur);
      points.push({ date, revenue: byDate.get(date) ?? 0 });
    }

    return Response.json({ points });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to load timeseries");
  }
}

