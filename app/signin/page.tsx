"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: "/pos",
        redirect: false
      });
      if (!res?.ok) {
        const detail =
          res?.error && res.error !== "CredentialsSignin"
            ? ` (${res.error})`
            : "";
        setError(`Login failed. Check your email and password.${detail}`);
        return;
      }
      window.location.href = "/pos";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-neutral-50 p-4">
      <div className="mx-auto flex max-w-md items-center">
        <div className="w-full rounded-2xl border border-neutral-200 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex justify-center">
          <Image
            src="/brand/logo.png"
            alt="DjajaPOS"
            width={440}
            height={128}
            priority
            className="h-24 w-auto"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <Link className="text-sm font-medium underline" href="/signup">
            Sign up
          </Link>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit}>
          <label className="mt-4 block text-sm font-medium">Email</label>
          <input
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-base outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
            style={{ minHeight: 44 }}
            inputMode="email"
            autoComplete="email"
            placeholder="owner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="mt-3 block text-sm font-medium">Password</label>
          <div className="relative mt-2">
            <input
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 pr-12 text-base outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
              style={{ minHeight: 44 }}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="password123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold"
              style={{ minHeight: 32 }}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-[#469d98] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3f8f8a] disabled:opacity-60"
            style={{ minHeight: 44 }}
            disabled={loading}
          >
            Continue
          </button>
        </form>
      </div>
      </div>
    </main>
  );
}

