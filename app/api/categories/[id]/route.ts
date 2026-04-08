import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

const ParamsSchema = z.object({ id: z.string().min(1) });

const UpdateCategorySchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const { id } = ParamsSchema.parse(await params);
    const body = await req.json();
    const input = UpdateCategorySchema.parse(body);

    const updated = await prisma.category.updateMany({
      where: { id, companyId: session.user.companyId },
      data: { name: input.name }
    });

    if (updated.count === 0) return jsonError(404, "Not found");
    const category = await prisma.category.findUnique({ where: { id } });
    return Response.json({ category });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to update category");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const { id } = ParamsSchema.parse(await params);

    const deleted = await prisma.category.deleteMany({
      where: { id, companyId: session.user.companyId }
    });
    if (deleted.count === 0) return jsonError(404, "Not found");

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    return jsonError(500, "Failed to delete category");
  }
}

