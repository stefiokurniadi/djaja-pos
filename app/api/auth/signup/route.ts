import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

const SignupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  branchName: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72)
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SignupSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return jsonError(409, "Email already in use");

    const passwordHash = await bcrypt.hash(input.password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: input.companyName }
      });
      const branch = await tx.branch.create({
        data: { name: input.branchName, companyId: company.id }
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          branchId: null,
          role: "OWNER",
          name: input.name,
          email: input.email,
          passwordHash
        },
        select: { id: true, email: true }
      });

      return { company, branch, user };
    });

    return Response.json(
      {
        ok: true,
        companyId: created.company.id,
        branchId: created.branch.id,
        userId: created.user.id
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Signup failed");
  }
}

