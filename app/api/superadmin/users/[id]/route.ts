"use server";

import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import bcrypt from "bcryptjs";

function idFromUrl(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return parts[parts.length - 1] || "";
}

function normalizeEmail(v: unknown) {
  if (typeof v !== "string") return "";
  return v.trim().toLowerCase();
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

    const body = (await req.json().catch(() => null)) as
      | {
          name?: unknown;
          email?: unknown;
          role?: unknown;
          isActive?: unknown;
          companyId?: unknown;
          branchId?: unknown;
          newPassword?: unknown;
        }
      | null;

    const email = body?.email !== undefined ? normalizeEmail(body.email) : undefined;
    const name = body?.name !== undefined ? (typeof body.name === "string" ? body.name.trim() : "") : undefined;
    const role = body?.role !== undefined ? (typeof body.role === "string" ? body.role : "") : undefined;
    const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : undefined;
    const companyId = body?.companyId !== undefined ? (typeof body.companyId === "string" ? body.companyId : "") : undefined;
    const branchId = body?.branchId !== undefined ? (typeof body.branchId === "string" ? body.branchId : "") : undefined;
    const newPassword = body?.newPassword !== undefined ? (typeof body.newPassword === "string" ? body.newPassword : "") : undefined;

    // Prevent editing the single SUPERADMIN via UI/API.
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return jsonError(404, "User not found");
    if (target.role === "SUPERADMIN") return jsonError(400, "Cannot modify SUPERADMIN");

    if (role !== undefined && !["OWNER", "ADMIN", "CASHIER"].includes(role)) {
      return jsonError(400, "Invalid role");
    }
    if (email !== undefined && !email) return jsonError(400, "Invalid email");
    if (companyId !== undefined && !companyId) return jsonError(400, "Invalid company");
    if (newPassword !== undefined && newPassword.length > 0 && newPassword.length < 8) {
      return jsonError(400, "Password too short");
    }

    const nextRole = role ?? target.role;
    const nextCompanyId =
      companyId ??
      (
        await prisma.user.findUnique({
          where: { id },
          select: { companyId: true }
        })
      )?.companyId ??
      undefined;

    if (!nextCompanyId) return jsonError(400, "Invalid company");

    if (nextRole === "CASHIER") {
      const nextBranchId = branchId !== undefined ? branchId : undefined;
      if (!nextBranchId) return jsonError(400, "Cashier requires branchId");
      const b = await prisma.branch.findFirst({
        where: { id: nextBranchId, companyId: nextCompanyId },
        select: { id: true }
      });
      if (!b) return jsonError(400, "Invalid branch");
    }

    const data: any = {};
    if (email !== undefined) data.email = email;
    if (name !== undefined) data.name = name || null;
    if (role !== undefined) data.role = role;
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (companyId !== undefined) data.companyId = companyId;
    if (branchId !== undefined) data.branchId = nextRole === "CASHIER" ? branchId : null;
    if (newPassword !== undefined && newPassword.length > 0) {
      data.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, companyId: true, branchId: true }
    });
    return Response.json({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to update user");
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

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return jsonError(404, "User not found");
    if (target.role === "SUPERADMIN") return jsonError(400, "Cannot delete SUPERADMIN");

    await prisma.user.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to delete user");
  }
}

