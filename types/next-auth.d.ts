import "next-auth";
import "next-auth/jwt";
import type { Role, Locale } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: Role;
      locale?: Locale;
      companyId?: string;
      companyName?: string;
      branchId?: string;
      branchName?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    locale?: Locale;
    companyId?: string;
    companyName?: string;
    branchId?: string;
    branchName?: string;
  }
}

