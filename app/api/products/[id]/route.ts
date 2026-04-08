import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

const ParamsSchema = z.object({ id: z.string().min(1) });

const UpdateProductSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().min(1).optional(),
  sku: z.string().trim().min(1).max(64).nullable().optional(),
  price: z.coerce.number().finite().nonnegative().optional(),
  costPrice: z.coerce.number().finite().nonnegative().optional(),
  isActive: z.coerce.boolean().optional()
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
    const input = UpdateProductSchema.parse(body);

    if (input.categoryId !== undefined) {
      const ok = await prisma.category.findFirst({
        where: { id: input.categoryId, companyId: session.user.companyId }
      });
      if (!ok) return jsonError(400, "Invalid category");
    }

    const updated = await prisma.product.updateMany({
      where: { id, branch: { companyId: session.user.companyId } },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });

    if (updated.count === 0) return jsonError(404, "Not found");

    const product = await prisma.product.findFirst({
      where: { id, branch: { companyId: session.user.companyId } },
      include: { category: true }
    });

    return Response.json({ product });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to update product");
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

    const deleted = await prisma.product.deleteMany({
      where: { id, branch: { companyId: session.user.companyId } }
    });
    if (deleted.count === 0) return jsonError(404, "Not found");

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    return jsonError(500, "Failed to delete product");
  }
}

