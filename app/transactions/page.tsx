"use client";

import { AppShell } from "@/components/AppShell";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import { apiGet } from "@/lib/api-client";
import { money } from "@/lib/money";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";

type TxItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  unitCost: string;
  lineTotal: string;
};

type Tx = {
  id: string;
  branchId: string;
  paymentMethod: "CASH" | "DIGITAL";
  subtotal: string;
  total: string;
  createdAt: string;
  branch: { id: string; name: string };
  items: TxItem[];
};

export default function TransactionsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isOwner = role === "OWNER";
  const locale = session?.user?.locale;

  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState<"CASH" | "DIGITAL">("CASH");
  const [editTotal, setEditTotal] = useState<string>("");

  const txQ = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiGet<{ transactions: Tx[] }>("/api/transactions"),
    staleTime: 10_000
  });

  const selected = useMemo(
    () => txQ.data?.transactions?.find((t) => t.id === selectedId) ?? null,
    [txQ.data?.transactions, selectedId]
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {t(locale, "nav.transactions")}
        </h1>
        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <MobileUserMenu />
          </div>
        </div>
      </div>

      {role === "CASHIER" ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          {t(locale, "transactions.adminOwnerOnly")}
        </div>
      ) : null}

      {txQ.isLoading ? (
        <div className="mt-3 text-sm text-neutral-600">
          {t(locale, "transactions.loading")}
        </div>
      ) : txQ.data?.transactions?.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>Branch / Trx</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Payment</div>
            </div>
            <div className="divide-y divide-neutral-200">
              {txQ.data.transactions.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    className={`w-full px-4 py-3 text-left hover:bg-neutral-50 ${
                      active ? "bg-neutral-50" : ""
                    }`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <div className="grid grid-cols-[1.2fr_1fr_1fr] items-start gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">
                          {t.branch?.name ?? "—"}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-neutral-500">
                          {t.id}
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-neutral-900">
                        {money(Number(t.total))}
                      </div>
                      <div className="text-right text-xs font-semibold text-neutral-700">
                        {t.paymentMethod === "CASH" ? "Cash" : "QRIS"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            {selected ? (
              <>
                <div className="text-sm font-semibold text-neutral-900">
                  Transaction
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {selected.branch?.name ?? "—"} • {new Date(selected.createdAt).toLocaleString()}
                </div>
                <div className="mt-2 rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-600">Trx ID</span>
                    <span className="font-semibold text-neutral-900">
                      {selected.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-600">Payment</span>
                    <span className="font-semibold text-neutral-900">
                      {selected.paymentMethod === "CASH" ? "Cash" : "QRIS"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-600">Total</span>
                    <span className="font-semibold text-neutral-900">
                      {money(Number(selected.total))}
                    </span>
                  </div>
                </div>

                <div className="mt-4 text-sm font-semibold text-neutral-900">
                  Items
                </div>
                <div className="mt-2 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
                  {selected.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {it.productName}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {it.quantity} × {money(Number(it.unitPrice))}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {money(Number(it.lineTotal))}
                      </div>
                    </div>
                  ))}
                </div>

                {isOwner ? (
                  <div className="mt-4 grid gap-2">
                    <button
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                      style={{ minHeight: 44 }}
                      onClick={async () => {
                        const ok = window.confirm(
                          t(locale, "transactions.removeConfirm")
                        );
                        if (!ok) return;
                        const res = await fetch(`/api/transactions/${selected.id}`, {
                          method: "DELETE",
                          credentials: "include"
                        });
                        if (!res.ok) {
                          const text = await res.text().catch(() => "");
                          alert(text || t(locale, "transactions.failedRemove"));
                          return;
                        }
                        setSelectedId(null);
                        await qc.invalidateQueries({ queryKey: ["transactions"] });
                      }}
                    >
                      {t(locale, "transactions.remove")}
                    </button>
                    <button
                      className="w-full rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                      style={{ minHeight: 44 }}
                      onClick={async () => {
                        setEditPaymentMethod(selected.paymentMethod);
                        setEditTotal(String(Number(selected.total)));
                        setEditOpen(true);
                      }}
                    >
                      {t(locale, "transactions.edit")}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-neutral-600">
                Select a transaction to view details.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          No successful transactions yet.
        </div>
      )}

      {editOpen && selected ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 md:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Edit transaction</div>
              <button
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
                style={{ minHeight: 44 }}
                onClick={() => setEditOpen(false)}
              >
                {t(locale, "common.close")}
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <label className="text-sm font-semibold">Payment method</label>
              <select
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value as any)}
              >
                <option value="CASH">Cash</option>
                <option value="DIGITAL">QRIS</option>
              </select>

              <label className="mt-2 text-sm font-semibold">Amount (Total)</label>
              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                inputMode="decimal"
                value={editTotal}
                onChange={(e) => setEditTotal(e.target.value)}
              />

              <button
                className="mt-2 w-full rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={!Number.isFinite(Number(editTotal)) || Number(editTotal) < 0}
                onClick={async () => {
                  const res = await fetch(`/api/transactions/${selected.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      paymentMethod: editPaymentMethod,
                      total: Number(editTotal)
                    })
                  });
                  if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    alert(text || t(locale, "transactions.failedEdit"));
                    return;
                  }
                  setEditOpen(false);
                  await qc.invalidateQueries({ queryKey: ["transactions"] });
                }}
              >
                {t(locale, "common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

