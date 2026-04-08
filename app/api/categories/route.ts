import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { branchScopeForRole, requireRole, requireSession } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const categories = await prisma.category.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: "asc" }
    });
    return Response.json({ categories });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to fetch categories");
  }
}

const CreateCategorySchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const body = await req.json();
    const input = CreateCategorySchema.parse(body);

    const category = await prisma.category.create({
      data: {
        companyId: session.user.companyId,
        name: input.name
      }
    });

    return Response.json({ category }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to create category");
  }
}

