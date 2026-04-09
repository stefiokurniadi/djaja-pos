"use server";

import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

function idFromUrl(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return parts[parts.length - 1] || "";
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const isSuperAdmin =
      session.user.role === "SUPERADMIN" ||
      (session.user.email ?? "").toLowerCase() === "superadmin@djajapos.com";
    if (!isSuperAdmin) return jsonError(403, "Forbidden");

    const id = idFromUrl(req);
    if (!id) return jsonError(400, "Missing id");

    const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2) return jsonError(400, "Invalid company name");

    const company = await prisma.company.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, createdAt: true, updatedAt: true }
    });
    return Response.json({ company });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to update company");
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    const isSuperAdmin =
      session.user.role === "SUPERADMIN" ||
      (session.user.email ?? "").toLowerCase() === "superadmin@djajapos.com";
    if (!isSuperAdmin) return jsonError(403, "Forbidden");

    const id = idFromUrl(req);
    if (!id) return jsonError(400, "Missing id");

    // Do not allow deleting the system company that hosts SUPERADMIN.
    const superAdmin = await prisma.user.findFirst({
      where: { role: "SUPERADMIN" },
      select: { companyId: true }
    });
    if (superAdmin?.companyId === id) return jsonError(400, "Cannot delete system company");

    await prisma.company.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to delete company");
  }
}

