import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { nextAuthSecureCookie } from "@/lib/next-auth-cookie";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect app pages (not assets)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/brand") ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: nextAuthSecureCookie()
  });

  // Public routes
  if (pathname === "/signin" || pathname === "/signup") {
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  const role = token.role as string | undefined;

  // Cashier restrictions
  if (role === "CASHIER") {
    if (pathname.startsWith("/menu") || pathname.startsWith("/iam")) {
      const url = req.nextUrl.clone();
      url.pathname = "/pos";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/).*)"]
};

