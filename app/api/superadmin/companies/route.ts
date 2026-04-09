"use server";

import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireSession();
    const isSuperAdmin =
      session.user.role === "SUPERADMIN" ||
      (session.user.email ?? "").toLowerCase() === "superadmin@djajapos.com";
    if (!isSuperAdmin) return jsonError(403, "Forbidden");

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, updatedAt: true }
    });
    return Response.json({ companies });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to load companies");
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const isSuperAdmin =
      session.user.role === "SUPERADMIN" ||
      (session.user.email ?? "").toLowerCase() === "superadmin@djajapos.com";
    if (!isSuperAdmin) return jsonError(403, "Forbidden");

    const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2) return jsonError(400, "Invalid company name");

    const company = await prisma.company.create({
      data: { name },
      select: { id: true, name: true, createdAt: true, updatedAt: true }
    });
    return Response.json({ company });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    return jsonError(500, "Failed to create company");
  }
}

