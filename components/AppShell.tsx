"use client";

import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <div className="mx-auto w-full max-w-[1400px] md:flex">
        <Sidebar />
        <main className="w-full p-4 pb-20 md:pb-4">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}

