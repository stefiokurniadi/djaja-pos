/**
 * Align cookie security with how the app is actually served.
 * If NEXTAUTH_URL is still http://localhost on Vercel, NextAuth would use
 * non-secure cookies while the site is HTTPS — login "succeeds" but the
 * session token is wrong/missing for middleware.
 */
export function nextAuthSecureCookie(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.NEXTAUTH_URL?.startsWith("https://"))
  );
}
