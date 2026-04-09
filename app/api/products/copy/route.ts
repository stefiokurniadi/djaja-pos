import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

const Schema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(1)
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const input = Schema.parse(await req.json());
    if (input.fromBranchId === input.toBranchId) {
      return jsonError(400, "Source and target branch must be different");
    }

    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: input.fromBranchId, companyId: session.user.companyId },
        select: { id: true }
      }),
      prisma.branch.findFirst({
        where: { id: input.toBranchId, companyId: session.user.companyId },
        select: { id: true }
      })
    ]);
    if (!fromBranch || !toBranch) return jsonError(400, "Invalid branch");

    const sourceProducts = await prisma.product.findMany({
      where: {
        id: { in: input.productIds },
        branchId: input.fromBranchId,
        branch: { companyId: session.user.companyId }
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        costPrice: true,
        isActive: true,
        categoryId: true
      }
    });
    if (sourceProducts.length !== input.productIds.length) {
      return jsonError(400, "Some selected products are invalid");
    }

    const targetSkus = await prisma.product.findMany({
      where: { branchId: input.toBranchId, branch: { companyId: session.user.companyId } },
      select: { sku: true }
    });
    const skuSet = new Set(targetSkus.map((p) => p.sku).filter((x): x is string => Boolean(x)));

    const toCreate = sourceProducts.filter((p) => {
      if (!p.sku) return true; // allow duplicates when sku is null
      return !skuSet.has(p.sku);
    });

    const created = await prisma.product.createMany({
      data: toCreate.map((p) => ({
        branchId: input.toBranchId,
        categoryId: p.categoryId,
        name: p.name,
        sku: p.sku,
        price: p.price,
        costPrice: p.costPrice,
        isActive: p.isActive
      }))
    });

    return Response.json({
      ok: true,
      requested: sourceProducts.length,
      copied: created.count,
      skipped: sourceProducts.length - toCreate.length
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to copy menu");
  }
}

