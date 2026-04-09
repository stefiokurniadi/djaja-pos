"use server";

import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

type Body = {
  photoDataUrl?: unknown;
  lat?: unknown;
  lng?: unknown;
};

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (session.user.role !== "CASHIER") return jsonError(403, "Forbidden");
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const body = (await req.json().catch(() => null)) as Body | null;
    const photoDataUrl = typeof body?.photoDataUrl === "string" ? body.photoDataUrl : "";
    const lat = typeof body?.lat === "number" ? body.lat : null;
    const lng = typeof body?.lng === "number" ? body.lng : null;

    if (!photoDataUrl.startsWith("data:image/")) {
      return jsonError(400, "Invalid photo");
    }
    if (photoDataUrl.length > 1_500_000) {
      return jsonError(400, "Photo too large");
    }

    const open = await prisma.attendance.findFirst({
      where: {
        companyId: session.user.companyId,
        userId: session.user.id,
        checkOutAt: null
      },
      orderBy: { checkInAt: "desc" },
      select: { id: true }
    });
    if (!open) return jsonError(400, "No active check-in");

    const attendance = await prisma.attendance.update({
      where: { id: open.id },
      data: {
        checkOutAt: new Date(),
        checkOutLat: lat,
        checkOutLng: lng,
        checkOutPhoto: photoDataUrl
      },
      select: { id: true, checkInAt: true, checkOutAt: true }
    });

    return Response.json({ attendance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (typeof msg === "string" && msg.toLowerCase().includes("attendance")) {
      return jsonError(
        500,
        'Attendance table is missing. Run `npx prisma migrate deploy` and `npx prisma generate`.'
      );
    }
    return jsonError(500, `Failed to check out (${msg})`);
  }
}

