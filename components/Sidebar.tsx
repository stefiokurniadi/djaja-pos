"use client";

import clsx from "clsx";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

const navItems = [
  { href: "/pos", labelKey: "nav.cashier" as const },
  { href: "/menu", labelKey: "nav.menu" as const },
  { href: "/dashboard", labelKey: "nav.dashboard" as const }
];

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const email = data?.user?.email ?? "—";
  const role = data?.user?.role ?? "—";
  const isCashier = role === "CASHIER";
  const locale = data?.user?.locale;

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
    <aside className="hidden md:flex md:h-dvh md:w-64 md:flex-col md:border-r md:border-neutral-200 md:p-4">
      <div className="flex items-center justify-between">
        <Link href="/pos" className="flex items-center gap-2">
          <Image
            src="/brand/logo.png"
            alt="DjajaPOS"
            width={280}
            height={80}
            priority
            className="h-[72px] w-auto"
          />
        </Link>
      </div>

      <nav className="mt-4 space-y-1">
        {(isCashier ? navItems.filter((n) => n.href !== "/menu") : navItems).map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                "flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold",
                "min-h-[44px]",
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:bg-neutral-50"
              )}
            >
              <span>{t(locale, it.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sticky bottom-4 mt-auto rounded-2xl border border-neutral-200 bg-white p-3">
        <div className="text-xs font-semibold text-neutral-900">Signed in</div>
        <div className="mt-1 truncate text-sm text-neutral-700">{email}</div>
        <div className="mt-1 inline-flex rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
          {role}
        </div>

        <div className="relative mt-3" ref={menuRef}>
          <button
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            style={{ minHeight: 44 }}
            onClick={() => setOpen((v) => !v)}
          >
            {t(locale, "settings")}
          </button>
          {open ? (
            <div className="absolute bottom-[52px] left-0 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
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
                className="block w-full px-3 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                style={{ minHeight: 44 }}
                onClick={() => signOut({ callbackUrl: "/signin" })}
              >
                {t(locale, "settings.logout")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

