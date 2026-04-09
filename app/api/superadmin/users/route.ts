"use server";

import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";
import bcrypt from "bcryptjs";

function normalizeEmail(v: unknown) {
  if (typeof v !== "string") return "";
  return v.trim().toLowerCase();
}

export async function GET() {
  try {
    const session = await requireSession();
    const isSuperAdmin =
      session.user.role === "SUPERADMIN" ||
      (session.user.email ?? "").toLowerCase() === "superadmin@djajapos.com";
    if (!isSuperAdmin) return jsonError(403, "Forbidden");

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        companyId: true,
        branchId: true,
        createdAt: true,
        company: { select: { name: true } },
        branch: { select: { name: true } }
      }
    });
    return Response.json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to load users");
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const isSuperAdmin =
      session.user.role === "SUPERADMIN" ||
      (session.user.email ?? "").toLowerCase() === "superadmin@djajapos.com";
    if (!isSuperAdmin) return jsonError(403, "Forbidden");

    const body = (await req.json().catch(() => null)) as
      | {
          name?: unknown;
          email?: unknown;
          password?: unknown;
          role?: unknown;
          companyId?: unknown;
          branchId?: unknown;
        }
      | null;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : "";
    const role = typeof body?.role === "string" ? body.role : "";
    const companyId = typeof body?.companyId === "string" ? body.companyId : "";
    const branchId = typeof body?.branchId === "string" ? body.branchId : undefined;

    if (!email || password.length < 8) return jsonError(400, "Invalid email or password");
    if (!companyId) return jsonError(400, "Missing companyId");
    if (!["OWNER", "ADMIN", "CASHIER"].includes(role)) return jsonError(400, "Invalid role");

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return jsonError(400, "Invalid company");

    if (role === "CASHIER") {
      if (!branchId) return jsonError(400, "Cashier requires branchId");
      const b = await prisma.branch.findFirst({
        where: { id: branchId, companyId },
        select: { id: true }
      });
      if (!b) return jsonError(400, "Invalid branch");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
        role: role as any,
        companyId,
        branchId: role === "CASHIER" ? branchId! : null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        companyId: true,
        branchId: true,
        createdAt: true
      }
    });
    return Response.json({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to create user");
  }
}

