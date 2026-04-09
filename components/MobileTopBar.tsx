"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { MobileUserMenu } from "@/components/MobileUserMenu";

export function MobileTopBar({ title }: { title?: string }) {
  const { data } = useSession();

  const company = data?.user?.companyName ?? "—";
  const branch =
    data?.user?.role === "CASHIER" ? (data?.user?.branchName ?? "—") : undefined;

  return (
    <div className="md:hidden">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Image
                src="/brand/logo.png"
                alt="DjajaPOS"
                width={120}
                height={36}
                priority
                className="h-7 w-auto"
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-neutral-900">
                  {title ?? company}
                </div>
                <div className="truncate text-[11px] text-neutral-500">
                  {branch ? `${company} • ${branch}` : company}
                </div>
              </div>
            </div>
            <MobileUserMenu />
          </div>
        </div>
      </div>
    </div>
  );
}

