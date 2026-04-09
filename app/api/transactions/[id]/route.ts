import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

const ParamsSchema = z.object({ id: z.string().min(1) });

const EditSchema = z.object({
  paymentMethod: z.enum(["CASH", "DIGITAL"]).optional(),
  total: z.coerce.number().finite().nonnegative().optional(),
  receivedAmount: z.coerce.number().nonnegative().nullable().optional(),
  items: z
    .array(
      z.object({
        productName: z.string().trim().min(1).max(200),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().finite().nonnegative(),
        unitCost: z.coerce.number().finite().nonnegative()
      })
    )
    .min(1)
    .optional()
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const { id } = ParamsSchema.parse(await params);
    const input = EditSchema.parse(await req.json());

    const existing = await prisma.transaction.findFirst({
      where: { id, branch: { companyId: session.user.companyId } },
      include: { items: true }
    });
    if (!existing) return jsonError(404, "Not found");
    if (existing.status !== "COMPLETED") return jsonError(400, "Only COMPLETED transactions can be edited");

    const updated = await prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.transactionItem.deleteMany({ where: { transactionId: id } });
        await tx.transactionItem.createMany({
          data: input.items.map((it) => ({
            transactionId: id,
            productId: null,
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: new Prisma.Decimal(it.unitPrice),
            unitCost: new Prisma.Decimal(it.unitCost),
            lineTotal: new Prisma.Decimal(it.unitPrice).mul(it.quantity)
          }))
        });
      } else if (typeof input.total === "number") {
        // Adjust totals without changing quantities by scaling unitPrice/lineTotal
        // so that sum(lineTotal) == input.total (keeps item mix consistent for reporting).
        const oldSubtotal = existing.items.reduce(
          (sum, it) => sum.add(it.lineTotal),
          new Prisma.Decimal(0)
        );
        if (oldSubtotal.gt(0)) {
          const factor = new Prisma.Decimal(input.total).div(oldSubtotal);
          for (const it of existing.items) {
            const nextUnitPrice = it.unitPrice.mul(factor);
            const nextLineTotal = nextUnitPrice.mul(it.quantity);
            await tx.transactionItem.update({
              where: { id: it.id },
              data: {
                unitPrice: nextUnitPrice,
                lineTotal: nextLineTotal
              }
            });
          }
        }
      }

      const agg = await tx.transactionItem.aggregate({
        where: { transactionId: id },
        _sum: { lineTotal: true }
      });
      const computedSubtotal = agg._sum.lineTotal ?? new Prisma.Decimal(0);
      const computedTotal = computedSubtotal;

      const paymentMethod = input.paymentMethod ?? existing.paymentMethod;
      const receivedAmount =
        input.receivedAmount !== undefined ? input.receivedAmount : existing.receivedAmount;

      const changeAmount =
        paymentMethod === "CASH" && typeof receivedAmount === "number"
          ? new Prisma.Decimal(receivedAmount).sub(computedTotal)
          : null;

      const nextTx = await tx.transaction.update({
        where: { id },
        data: {
          ...(input.paymentMethod !== undefined ? { paymentMethod } : {}),
          ...(input.receivedAmount !== undefined ? { receivedAmount } : {}),
          subtotal: computedSubtotal,
          total: computedTotal,
          changeAmount
        },
        include: { branch: { select: { id: true, name: true } }, items: true }
      });

      await tx.transactionLog.create({
        data: {
          transactionId: id,
          actorUserId: session.user.id,
          action: "EDIT",
          before: {
            paymentMethod: existing.paymentMethod,
            receivedAmount: existing.receivedAmount,
            subtotal: existing.subtotal,
            total: existing.total,
            changeAmount: existing.changeAmount,
            items: existing.items.map((it) => ({
              productName: it.productName,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              unitCost: it.unitCost,
              lineTotal: it.lineTotal
            }))
          },
          after: {
            paymentMethod: nextTx.paymentMethod,
            receivedAmount: nextTx.receivedAmount,
            subtotal: nextTx.subtotal,
            total: nextTx.total,
            changeAmount: nextTx.changeAmount,
            items: nextTx.items.map((it) => ({
              productName: it.productName,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              unitCost: it.unitCost,
              lineTotal: it.lineTotal
            }))
          }
        }
      });

      return nextTx;
    });

    return Response.json({ transaction: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    if (msg.includes("TransactionLog") && msg.toLowerCase().includes("does not exist")) {
      return jsonError(500, "TransactionLog table missing. Run prisma migrate/deploy then try again.");
    }
    return jsonError(500, "Failed to edit transaction");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const { id } = ParamsSchema.parse(await params);

    const existing = await prisma.transaction.findFirst({
      where: { id, branch: { companyId: session.user.companyId } },
      include: { items: true }
    });
    if (!existing) return jsonError(404, "Not found");
    if (existing.status !== "COMPLETED") return jsonError(400, "Already voided");

    const updated = await prisma.$transaction(async (tx) => {
      const nextTx = await tx.transaction.update({
        where: { id },
        data: { status: "VOIDED" }
      });
      await tx.transactionLog.create({
        data: {
          transactionId: id,
          actorUserId: session.user.id,
          action: "SOFT_DELETE",
          before: { status: existing.status, total: existing.total },
          after: { status: nextTx.status, total: nextTx.total }
        }
      });
      return nextTx;
    });

    return Response.json({ ok: true, transaction: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (msg.includes("TransactionLog") && msg.toLowerCase().includes("does not exist")) {
      return jsonError(500, "TransactionLog table missing. Run prisma migrate/deploy then try again.");
    }
    return jsonError(500, "Failed to delete transaction");
  }
}

