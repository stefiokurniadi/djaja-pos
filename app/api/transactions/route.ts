import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

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
  receivedAmount: z.coerce.number().nonnegative().optional()
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.user.branchId) return jsonError(400, "Missing branch");

    const body = await req.json();
    const input = CreateTransactionSchema.parse(body);

    // Enforce branch scoping: only allow products from cashier's branch unless OWNER.
    const isOwner = session.user.role === "OWNER";
    const productIds = input.items.map((i) => i.productId);

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        ...(isOwner ? {} : { branchId: session.user.branchId })
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
          branchId: session.user.branchId!,
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

