"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

export function MobileUserMenu() {
  const { data } = useSession();
  const locale = data?.user?.locale;
  const email = data?.user?.email ?? "—";
  const role = data?.user?.role ?? "—";
  const isCashier = role === "CASHIER";

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm"
        style={{ minHeight: 44, minWidth: 44 }}
        aria-label="Open user menu"
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>

      {open ? (
        <div className="absolute right-0 top-[52px] w-72 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
          <div className="p-3">
            <div className="text-xs font-semibold text-neutral-900">Signed in</div>
            <div className="mt-1 truncate text-sm text-neutral-700">{email}</div>
            <div className="mt-2 inline-flex rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
              {role}
            </div>
          </div>

          <div className="border-t border-neutral-200">
            {!isCashier ? (
              <Link
                href="/iam"
                className="block px-3 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                style={{ minHeight: 44 }}
                onClick={() => setOpen(false)}
              >
                {t(locale, "settings.iam")}
              </Link>
            ) : null}

            <button
              type="button"
              className="block w-full px-3 py-3 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              style={{ minHeight: 44 }}
              onClick={async () => {
                const next = locale === "en" ? "id" : "en";
                await fetch("/api/me/preferences", {
                  method: "PATCH",
                  credentials: "include",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ locale: next })
                });
                window.location.reload();
              }}
            >
              {t(locale, "settings.language")}: {locale === "en" ? "English" : "Bahasa Indonesia"}
            </button>

            <button
              type="button"
              className="block w-full px-3 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
              style={{ minHeight: 44 }}
              onClick={() => signOut({ callbackUrl: "/signin" })}
            >
              {t(locale, "settings.logout")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

