import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

const ParamsSchema = z.object({ id: z.string().min(1) });

const PatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  role: z.enum(["ADMIN", "CASHIER"]).optional(),
  branchId: z.string().min(1).nullable().optional(),
  isActive: z.coerce.boolean().optional(),
  newPassword: z.string().min(8).max(72).optional()
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    const actorRole = session.user.role!;
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const { id } = ParamsSchema.parse(await params);
    const body = await req.json();
    const input = PatchSchema.parse(body);

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, branchId: true, companyId: true }
    });
    if (!target) return jsonError(404, "Not found");
    if (target.companyId !== session.user.companyId) {
      return jsonError(403, "Company restricted");
    }

    // Never allow editing OWNER accounts via this endpoint.
    if (target.role === "OWNER") return jsonError(403, "Cannot modify owner");

    // ADMIN scope limitations: can only manage CASHIER users (in company).
    if (actorRole === "ADMIN") {
      if (target.role !== "CASHIER") return jsonError(403, "Admins can only manage cashiers");
      if (input.role === "ADMIN") {
        return jsonError(403, "Admins cannot create admins");
      }
    }

    // Enforce cashier branch dependency.
    const nextRole = input.role ?? (target.role as "ADMIN" | "CASHIER");
    const nextBranchId =
      input.branchId === undefined ? target.branchId : input.branchId;

    if (nextRole === "CASHIER" && !nextBranchId) {
      return jsonError(400, "Cashier must have a branch");
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.role !== undefined) data.role = input.role;
    if (input.branchId !== undefined) data.branchId = input.branchId;
    if (input.role === "ADMIN") data.branchId = null;
    if (input.newPassword !== undefined) {
      data.passwordHash = await bcrypt.hash(input.newPassword, 12);
    }

    if (Object.keys(data).length === 0) return jsonError(400, "No changes");

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true
      }
    });

    return Response.json({ user: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to update user");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const { id } = ParamsSchema.parse(await params);

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, companyId: true }
    });
    if (!target) return jsonError(404, "Not found");
    if (target.companyId !== session.user.companyId) {
      return jsonError(403, "Company restricted");
    }
    if (target.role === "OWNER") return jsonError(403, "Cannot delete owner");

    if (session.user.role === "ADMIN" && target.role !== "CASHIER") {
      return jsonError(403, "Admins can only delete cashiers");
    }

    const deleted = await prisma.user.delete({ where: { id } });
    return Response.json({ ok: true, userId: deleted.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to delete user");
  }
}

