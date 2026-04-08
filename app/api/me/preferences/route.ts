import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/rbac";

const PatchSchema = z.object({
  locale: z.enum(["id", "en"])
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const input = PatchSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { locale: input.locale }
    });

    return Response.json({ ok: true, locale: user.locale });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Unauthorized");
    if (e instanceof z.ZodError) return jsonError(400, e.message);
    return jsonError(500, "Failed to update preferences");
  }
}

