"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useSession } from "next-auth/react";
import { t } from "@/lib/i18n";

const items = [
  { href: "/pos", labelKey: "nav.cashier" as const },
  { href: "/menu", labelKey: "nav.menu" as const },
  { href: "/dashboard", labelKey: "nav.dashboard" as const }
];

export function BottomNav() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const locale = data?.user?.locale;
  const visibleItems =
    role === "CASHIER"
      ? items.filter((i) => i.href !== "/menu")
      : items;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 md:hidden">
      <div className={clsx("mx-auto grid max-w-xl", visibleItems.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {visibleItems.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                "px-3 py-3 text-center text-sm font-medium",
                "min-h-[44px]",
                active ? "text-neutral-900" : "text-neutral-500"
              )}
            >
              {t(locale, it.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

