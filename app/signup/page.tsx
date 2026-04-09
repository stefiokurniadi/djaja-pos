"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import Image from "next/image";

export default function SignUpPage() {
  const [companyName, setCompanyName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center p-4">
      <div className="w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
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
          <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
          <Link className="text-sm font-medium underline" href="/signin">
            Sign in
          </Link>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-medium">Company name</label>
        <input
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-base outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
          style={{ minHeight: 44 }}
          placeholder="My Company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <label className="mt-4 block text-sm font-medium">Branch name</label>
        <input
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-base outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
          style={{ minHeight: 44 }}
          placeholder="Main Branch"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
        />

        <label className="mt-3 block text-sm font-medium">Your name</label>
        <input
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-base outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
          style={{ minHeight: 44 }}
          placeholder="Owner"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mt-3 block text-sm font-medium">Email</label>
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
            autoComplete="new-password"
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

        <label className="mt-3 block text-sm font-medium">Re-type password</label>
        <input
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-base outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
          style={{ minHeight: 44 }}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="password123"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
        />

        <button
          className="mt-4 w-full rounded-xl bg-[#469d98] px-4 py-3 text-base font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
          style={{ minHeight: 44 }}
          disabled={loading || password.length < 8 || password2 !== password}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await apiPost("/api/auth/signup", {
                companyName,
                branchName,
                name,
                email,
                password
              });
              await signIn("credentials", { email, password, callbackUrl: "/pos" });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Signup failed. Please try again.");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </div>
    </main>
  );
}

