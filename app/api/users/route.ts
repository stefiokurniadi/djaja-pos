import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const where = { companyId: session.user.companyId };

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        branchId: true,
        isActive: true,
        createdAt: true
      }
    });

    return Response.json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    return jsonError(500, "Failed to fetch users");
  }
}

const CreateUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["ADMIN", "CASHIER"]),
  branchId: z.string().min(1).optional()
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireRole(session.user.role, ["OWNER", "ADMIN"]);
    if (!session.user.companyId) return jsonError(400, "Missing company");

    const body = await req.json();
    const input = CreateUserSchema.parse(body);

    // Rule: ADMIN cannot create another ADMIN.
    if (session.user.role === "ADMIN" && input.role === "ADMIN") {
      return jsonError(403, "Admins cannot create admins");
    }

    // Cashier must have branchId.
    if (input.role === "CASHIER" && !input.branchId) {
      return jsonError(400, "Cashier must have a branch");
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return jsonError(409, "Email already in use");

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        companyId: session.user.companyId,
        branchId: input.role === "CASHIER" ? input.branchId! : null,
        passwordHash
      },
      select: { id: true, email: true, role: true, branchId: true, name: true }
    });

    return Response.json({ user }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (msg === "FORBIDDEN") return jsonError(403, "Forbidden");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to create user");
  }
}

