import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.user.companyId) return jsonError(400, "Missing company");

    // Company-scoped branches. Owner/Admin can see all branches in company.
    // Cashier sees only their assigned branch.
    if (session.user.role === "CASHIER") {
      if (!session.user.branchId) return jsonError(400, "Missing branch");
      const branch = await prisma.branch.findFirst({
        where: { id: session.user.branchId, companyId: session.user.companyId }
      });
      return Response.json({ branches: branch ? [branch] : [] });
    }

    const branches = await prisma.branch.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: "asc" }
    });
    return Response.json({ branches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to fetch branches");
  }
}

const CreateBranchSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const body = await req.json();
    const input = CreateBranchSchema.parse(body);

    const branch = await prisma.branch.create({
      data: { name: input.name, companyId: session.user.companyId }
    });
    return Response.json({ branch }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to create branch");
  }
}

