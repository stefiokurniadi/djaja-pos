import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            isActive: true,
            companyId: true
          }
        });
        if (!user) return null;
        if (!user.isActive) return null;
        if (!user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (!token.sub) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          id: true,
          role: true,
          locale: true,
          companyId: true,
          branchId: true,
          email: true,
          name: true,
          isActive: true,
          company: { select: { name: true } },
          branch: { select: { name: true } }
        }
      });
      if (!dbUser) return token;
      if (!dbUser.isActive) return token;

      token.role = dbUser.role;
      token.locale = dbUser.locale;
      token.companyId = dbUser.companyId;
      token.companyName = dbUser.company.name;
      token.branchId = dbUser.branchId;
      token.branchName = dbUser.branch?.name;
      token.email = dbUser.email ?? token.email;
      token.name = dbUser.name ?? token.name;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.locale = token.locale;
        session.user.companyId = token.companyId;
        session.user.companyName = token.companyName;
        session.user.branchId = token.branchId;
        session.user.branchName = token.branchName;
      }
      return session;
    }
  }
};

