import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Role } from "@prisma/client";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function requireRole(userRole: Role | undefined, allowed: Role[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new Error("FORBIDDEN");
  }
}

export function branchScopeForRole(
  userRole: Role | undefined,
  userBranchId: string | undefined
): { branchId?: string } {
  if (userRole === "CASHIER") {
    if (!userBranchId) throw new Error("NO_BRANCH");
    return { branchId: userBranchId };
  }
  // OWNER/ADMIN are not branch-dependent
  return {};
}

