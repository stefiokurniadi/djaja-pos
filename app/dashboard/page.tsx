"use client";

import { AppShell } from "@/components/AppShell";
import { apiGet } from "@/lib/api-client";
import { money } from "@/lib/money";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  lastMonthRange,
  lastWeekRange,
  thisMonthRange,
  thisWeekRange,
  todayRange,
  toISODate,
  yesterdayRange
} from "@/lib/date-ranges";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import { t } from "@/lib/i18n";

export default function DashboardPage() {
  const { data: session } = useSession();
  const isCashier = String(session?.user?.role) === "CASHIER";
  const locale = session?.user?.locale;

  const presets = [
    { id: "today", label: "Today", range: todayRange },
    { id: "yesterday", label: "Yesterday", range: yesterdayRange },
    { id: "thisWeek", label: "This Week", range: thisWeekRange },
    { id: "lastWeek", label: "Last Week", range: lastWeekRange },
    { id: "thisMonth", label: "This Month", range: thisMonthRange },
    { id: "lastMonth", label: "Last Month", range: lastMonthRange }
  ] as const;

  type PresetId = (typeof presets)[number]["id"] | "custom";
  const [presetId, setPresetId] = useState<PresetId>("today");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const activeRange = useMemo(() => {
    if (presetId === "custom" && customFrom && customTo) {
      return { from: new Date(customFrom), to: new Date(customTo) };
    }
    const p = presets.find((x) => x.id === presetId);
    return (p ?? presets[0]).range(new Date());
  }, [presetId, customFrom, customTo]);

  const branchesQ = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiGet<{ branches: { id: string; name: string }[] }>("/api/branches"),
    staleTime: 30_000
  });
  const branches = branchesQ.data?.branches ?? [];

  const [branchId, setBranchId] = useState<string | "ALL">("ALL");
  const effectiveBranchId = isCashier ? session?.user?.branchId : branchId;

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", activeRange.from.toISOString());
    params.set("to", activeRange.to.toISOString());
    if (effectiveBranchId && effectiveBranchId !== "ALL") {
      params.set("branchId", effectiveBranchId);
    }
    return params.toString();
  }, [activeRange.from, activeRange.to, effectiveBranchId]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-summary", qs],
    queryFn: () =>
      apiGet<{
        totalRevenue: string;
        totalCogs: string;
        totalProfit: string;
        orderCount: number;
        topItems: { productName: string; quantity: number; revenue: string }[];
      }>(`/api/reports/summary?${qs}`),
    staleTime: 10_000
  });

  const seriesQ = useQuery({
    queryKey: ["report-series", qs],
    queryFn: () =>
      apiGet<{ points: { date: string; revenue: number }[] }>(
        `/api/reports/timeseries?${qs}`
      ),
    staleTime: 10_000
  });

  const revenue = data ? Number(data.totalRevenue) : 0;
  const cogs = data ? Number(data.totalCogs) : 0;
  const profit = data ? Number(data.totalProfit) : 0;
  const orders = data ? Number(data.orderCount ?? 0) : 0;
  const avgBasket = orders > 0 ? revenue / orders : 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {t(locale, "nav.dashboard")}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/api/reports/summary/export"
            className="rounded-xl border border-neutral-200 bg-white/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white"
            style={{ minHeight: 44 }}
          >
            Export XLSX
          </Link>
          <div className="md:hidden">
            <MobileUserMenu />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`rounded-full border px-3 py-2 text-sm font-semibold ${
                presetId === p.id
                  ? "border-[#469d98] bg-[#469d98] text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
              style={{ minHeight: 44 }}
              onClick={() => setPresetId(p.id)}
            >
              {p.label}
            </button>
          ))}
          <button
            className={`rounded-full border px-3 py-2 text-sm font-semibold ${
              presetId === "custom"
                ? "border-[#469d98] bg-[#469d98] text-white"
                : "border-neutral-200 bg-white text-neutral-700"
            }`}
            style={{ minHeight: 44 }}
            onClick={() => {
              setPresetId("custom");
              if (!customFrom || !customTo) {
                const r = thisWeekRange(new Date());
                setCustomFrom(toISODate(r.from));
                setCustomTo(toISODate(r.to));
              }
            }}
          >
            Custom
          </button>
        </div>

        <div className="flex items-center gap-2">
          {presetId === "custom" ? (
            <>
              <input
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
                style={{ minHeight: 44 }}
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
                style={{ minHeight: 44 }}
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold text-neutral-500">Branch</div>
        <select
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ minHeight: 44 }}
          disabled={isCashier}
          value={isCashier ? (session?.user?.branchId ?? "") : branchId}
          onChange={(e) => setBranchId(e.target.value as any)}
        >
          <option value="ALL">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Sales" value={money(revenue)} />
            <StatCard label="Orders" value={String(orders)} />
            <StatCard label="Avg basket" value={money(avgBasket)} />
            <StatCard label="Profit" value={money(profit)} />
          </>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Sales</div>
          <div className="text-xs text-neutral-500">
            {toISODate(activeRange.from)} → {toISODate(activeRange.to)}
          </div>
        </div>
        <SalesBars points={seriesQ.data?.points ?? []} />
      </div>

      {data?.topItems?.length ? (
        <div className="mt-6">
          <div className="text-sm font-semibold">Top selling items</div>
          <div className="mt-2 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
            {data.topItems.map((it) => (
              <div key={it.productName} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.productName}</div>
                  <div className="text-xs text-neutral-500">{it.quantity} sold</div>
                </div>
                <div className="text-sm font-semibold">{money(Number(it.revenue))}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function SalesBars({ points }: { points: { date: string; revenue: number }[] }) {
  const max = Math.max(0, ...points.map((p) => p.revenue));
  if (!points.length) {
    return <div className="mt-3 text-sm text-neutral-600">No data.</div>;
  }

  return (
    <div className="mt-3">
      <div className="flex items-end gap-1">
        {points.map((p) => {
          const h = max > 0 ? Math.round((p.revenue / max) * 120) : 0;
          return (
            <div key={p.date} className="flex-1">
              {p.revenue > 0 ? (
                <div
                  className="w-full rounded-md bg-[#469d98]"
                  style={{ height: Math.max(2, h) }}
                  title={`${p.date}: ${p.revenue}`}
                />
              ) : (
                <div className="w-full" style={{ height: 2 }} title={`${p.date}: 0`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 text-[10px] font-semibold text-neutral-500">
        {points.map((p) => (
          <div key={p.date} className="flex-1 text-center" title={p.date}>
            {p.date.slice(8, 10)}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="text-xs font-semibold text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/60 p-4 shadow-sm backdrop-blur">
      <div className="h-3 w-20 animate-pulse rounded bg-neutral-200" />
      <div className="mt-3 h-6 w-28 animate-pulse rounded bg-neutral-200" />
    </div>
  );
}

