import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { branchScopeForRole, requireRole, requireSession } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.companyId) return jsonError(400, "Missing company");
    const scope = branchScopeForRole(session.user.role, session.user.branchId);

    const url = new URL(req.url);
    const requestedBranchId = url.searchParams.get("branchId") || undefined;
    const baseWhere = { branch: { companyId: session.user.companyId } } as const;
    const where =
      scope.branchId
        ? { ...baseWhere, branchId: scope.branchId }
        : requestedBranchId
          ? { ...baseWhere, branchId: requestedBranchId }
          : baseWhere;

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { category: true }
    });

    return Response.json({ products });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to fetch products");
  }
}

const CreateProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: z.string().min(1),
  sku: z.string().trim().min(1).max(64).optional(),
  price: z.coerce.number().finite().nonnegative(),
  costPrice: z.coerce.number().finite().nonnegative(),
  isActive: z.coerce.boolean().optional(),
  branchId: z.string().min(1).optional()
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const body = await req.json();
    const input = CreateProductSchema.parse(body);

    const branchId =
      session.user.role === "CASHIER"
        ? session.user.branchId
        : input.branchId;
    if (!branchId) return jsonError(400, "Branch is required");

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: session.user.companyId }
    });
    if (!branch) return jsonError(400, "Invalid branch");

    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, companyId: session.user.companyId }
    });
    if (!category) return jsonError(400, "Invalid category");

    const product = await prisma.product.create({
      data: {
        branchId,
        categoryId: input.categoryId,
        name: input.name,
        sku: input.sku,
        price: input.price,
        costPrice: input.costPrice,
        isActive: input.isActive ?? true
      }
    });

    return Response.json({ product }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to create product");
  }
}

