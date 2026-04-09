"use server";

import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const role = session.user.role;
    const where =
      role === "CASHIER"
        ? { companyId: session.user.companyId, userId: session.user.id }
        : { companyId: session.user.companyId };

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { checkInAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, email: true, name: true } },
        branch: { select: { id: true, name: true } }
      }
    });

    const open = await prisma.attendance.findFirst({
      where: {
        companyId: session.user.companyId,
        userId: session.user.id,
        checkOutAt: null
      },
      orderBy: { checkInAt: "desc" },
      select: { id: true, checkInAt: true }
    });

    return Response.json({ attendances, open });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to load attendance");
  }
}

