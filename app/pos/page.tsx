"use client";

import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useCategories, useProducts } from "@/lib/pos-queries";
import { decimalToNumber, money } from "@/lib/money";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/components/Toast";
import { useSession } from "next-auth/react";
import { t } from "@/lib/i18n";
import Image from "next/image";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

type CreatedTx = {
  id: string;
  paymentMethod: "CASH" | "DIGITAL";
  subtotal: string;
  total: string;
  receivedAmount: string | null;
  changeAmount: string | null;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
};

export default function PosPage() {
  const { data: session } = useSession();
  const locale = session?.user?.locale;
  const [flashProductId, setFlashProductId] = useState<string | null>(null);
  const [flashCartBtn, setFlashCartBtn] = useState<string | null>(null);

  const branchesQ = useQuery({
    queryKey: ["branches"],
    queryFn: () =>
      apiGet<{ branches: { id: string; name: string }[] }>("/api/branches"),
    staleTime: 30_000
  });
  const branches = branchesQ.data?.branches ?? [];
  const [activeBranchId, setActiveBranchId] = useState<string>("");

  const effectiveBranchId =
    session?.user?.role === "CASHIER" ? session?.user?.branchId : activeBranchId;

  useEffect(() => {
    if (session?.user?.role === "CASHIER") return;
    if (activeBranchId) return;
    if (branches.length > 0) setActiveBranchId(branches[0].id);
  }, [activeBranchId, branches, session?.user?.role]);

  const { data: catData, isLoading: catsLoading } = useCategories();
  const { data: prodData, isLoading: prodsLoading } = useProducts(effectiveBranchId);

  const categories = catData?.categories ?? [];
  const products = prodData?.products ?? [];

  const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">(
    "ALL"
  );

  const categoriesWithItems = useMemo(() => {
    const active = products.filter((p) => p.isActive);
    const ids = new Set(active.map((p) => p.categoryId).filter(Boolean) as string[]);
    return categories.filter((c) => ids.has(c.id));
  }, [products, categories]);

  const visibleProducts = useMemo(() => {
    const active = products.filter((p) => p.isActive);
    if (activeCategoryId === "ALL") return active;
    return active.filter((p) => p.categoryId === activeCategoryId);
  }, [products, activeCategoryId]);

  const [cart, setCart] = useState<
    Record<
      string,
      { productId: string; name: string; unitPrice: number; qty: number }
    >
  >({});

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const subtotal = useMemo(
    () => cartItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0),
    [cartItems]
  );

  const toast = useToast();
  const [checkingOut, setCheckingOut] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [qrisModalOpen, setQrisModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [doneTx, setDoneTx] = useState<CreatedTx | null>(null);

  const flash = (kind: "product" | "cart", key: string) => {
    if (kind === "product") {
      setFlashProductId(key);
      window.setTimeout(() => setFlashProductId(null), 120);
      return;
    }
    setFlashCartBtn(key);
    window.setTimeout(() => setFlashCartBtn(null), 120);
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {t(locale, "nav.cashier")}
        </h1>
        <div className="flex items-center gap-2">
          {session?.user?.role !== "CASHIER" ? (
            <select
              className="hidden rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm backdrop-blur md:block"
              style={{ minHeight: 44 }}
              value={activeBranchId}
              onChange={(e) => setActiveBranchId(e.target.value)}
              disabled={branchesQ.isLoading || branches.length === 0}
            >
              <option value="" disabled>
                {branchesQ.isLoading ? "Loading branches…" : "Select branch"}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="text-xs font-semibold text-neutral-500">
            {session?.user?.role === "CASHIER"
              ? `Cashier Page | ${session.user.companyName ?? "—"} | ${session.user.branchName ?? "—"}`
              : session?.user?.role === "OWNER"
                ? `Owner Page | ${session.user.companyName ?? "—"}`
                : session?.user?.role === "ADMIN"
                  ? `Admin Page | ${session.user.companyName ?? "—"}`
                  : `POS | ${session?.user?.companyName ?? "—"}`}
          </div>
          <div className="md:hidden">
            <MobileUserMenu />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          {session?.user?.role !== "CASHIER" && !effectiveBranchId ? (
            <div className="text-sm text-neutral-600">
              Select a branch to start selling.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-medium ${
                activeCategoryId === "ALL"
                  ? "border-[#469d98] bg-[#469d98] text-white"
                  : "border-neutral-200 bg-white/80 text-neutral-700 hover:bg-white"
              }`}
              onClick={() => setActiveCategoryId("ALL")}
            >
              All
            </button>
            {categoriesWithItems.map((c) => (
              <button
                key={c.id}
                className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-medium ${
                  activeCategoryId === c.id
                    ? "border-[#469d98] bg-[#469d98] text-white"
                    : "border-neutral-200 bg-white/80 text-neutral-700 hover:bg-white"
                }`}
                onClick={() => setActiveCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {(catsLoading || prodsLoading) && (
              <div className="text-sm text-neutral-600">Loading…</div>
            )}

            {!catsLoading &&
              !prodsLoading &&
              effectiveBranchId &&
              visibleProducts.length === 0 && (
              <div className="text-sm text-neutral-600">
                No active products yet. Add some in Menu.
              </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((p) => {
                const unitPrice = decimalToNumber(p.price);
                const flashed = flashProductId === p.id;
                return (
                  <button
                    key={p.id}
                    className={`flex aspect-square flex-col justify-between rounded-2xl border bg-white/80 p-3 text-left shadow-sm backdrop-blur hover:bg-white active:scale-[0.99] ${
                      flashed ? "border-[#469d98] ring-2 ring-[#469d98]" : "border-neutral-200"
                    }`}
                    onClick={() => {
                      flash("product", p.id);
                      setCart((prev) => {
                        const existing = prev[p.id];
                        const nextQty = (existing?.qty ?? 0) + 1;
                        return {
                          ...prev,
                          [p.id]: {
                            productId: p.id,
                            name: p.name,
                            unitPrice,
                            qty: nextQty
                          }
                        };
                      });
                    }}
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-[15px] font-semibold leading-snug">
                        {p.name}
                      </div>
                      <div className="mt-1 truncate text-[12px] font-medium text-neutral-500">
                        {p.category?.name}
                      </div>
                    </div>
                    <div className="text-[15px] font-semibold">{money(unitPrice)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <aside className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="text-sm font-medium">{t(locale, "cart.title")}</div>

          {cartItems.length === 0 ? (
            <div className="mt-3 text-sm text-neutral-600">
              {t(locale, "cart.empty")}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {cartItems.map((it) => (
                <div
                  key={it.productId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-neutral-500">
                      {money(it.unitPrice)} × {it.qty}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        flashCartBtn === `${it.productId}:dec`
                          ? "border-[#469d98] bg-[#469d98] text-white"
                          : "border-neutral-200 bg-white/80 text-neutral-900 hover:bg-white"
                      }`}
                      style={{ minHeight: 44, minWidth: 44 }}
                      onClick={() => {
                        flash("cart", `${it.productId}:dec`);
                        setCart((prev) => {
                          const existing = prev[it.productId];
                          if (!existing) return prev;
                          const nextQty = existing.qty - 1;
                          const next = { ...prev };
                          if (nextQty <= 0) delete next[it.productId];
                          else next[it.productId] = { ...existing, qty: nextQty };
                          return next;
                        });
                      }}
                    >
                      −
                    </button>
                    <button
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        flashCartBtn === `${it.productId}:inc`
                          ? "border-[#469d98] bg-[#469d98] text-white"
                          : "border-neutral-200 bg-white/80 text-neutral-900 hover:bg-white"
                      }`}
                      style={{ minHeight: 44, minWidth: 44 }}
                      onClick={() => {
                        flash("cart", `${it.productId}:inc`);
                        setCart((prev) => {
                          const existing = prev[it.productId];
                          if (!existing) return prev;
                          return {
                            ...prev,
                            [it.productId]: { ...existing, qty: existing.qty + 1 }
                          };
                        });
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="border-t border-neutral-200 pt-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-neutral-600">Subtotal</div>
                  <div className="font-semibold">{money(subtotal)}</div>
                </div>
                <button
                  className="mt-3 w-full rounded-xl bg-[#469d98] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3f8f8a] disabled:opacity-60"
                  style={{ minHeight: 44 }}
                  disabled={checkingOut || cartItems.length === 0}
                  onClick={() => {
                    setCashReceived(String(subtotal));
                    setCashModalOpen(true);
                  }}
                >
                  {t(locale, "pos.payCash")}
                </button>
                <button
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white/80 px-4 py-3 text-sm font-semibold text-neutral-900 backdrop-blur hover:bg-white disabled:opacity-60"
                  style={{ minHeight: 44 }}
                  disabled={checkingOut || cartItems.length === 0}
                  onClick={() => setQrisModalOpen(true)}
                >
                  {t(locale, "pos.payQris")}
                </button>
                <button
                  className="mt-6 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-200"
                  style={{ minHeight: 44 }}
                  onClick={() => setCart({})}
                >
                  {t(locale, "pos.clearCart")}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {cashModalOpen ? (
        <Modal
          title={t(locale, "pos.payWithCashTitle")}
          onClose={() => setCashModalOpen(false)}
          actions={
            <>
              <button
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"
                style={{ minHeight: 44 }}
                disabled={checkingOut}
                onClick={() => setCashModalOpen(false)}
              >
                {t(locale, "pos.cancel")}
              </button>
              <button
                className="flex-1 rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={
                  checkingOut ||
                  Number(cashReceived) < subtotal ||
                  !Number.isFinite(Number(cashReceived))
                }
                onClick={async () => {
                  setCheckingOut(true);
                  try {
                    const res = await apiPost<{ transaction: CreatedTx }>(
                      "/api/transactions",
                      {
                        paymentMethod: "CASH",
                        receivedAmount: Number(cashReceived),
                        ...(session?.user?.role === "CASHIER"
                          ? {}
                          : effectiveBranchId
                            ? { branchId: effectiveBranchId }
                            : {}),
                        items: cartItems.map((it) => ({
                          productId: it.productId,
                          quantity: it.qty
                        }))
                      }
                    );
                    setCashModalOpen(false);
                    setCart({});
                    setDoneTx(res.transaction);
                  } catch (e) {
                    toast.push(t(locale, "pos.checkoutFailed"));
                  } finally {
                    setCheckingOut(false);
                  }
                }}
              >
                {t(locale, "pos.confirm")}
              </button>
            </>
          }
        >
          <div className="text-sm text-neutral-600">
            {t(locale, "pos.total")}:{" "}
            <span className="font-semibold text-neutral-900">{money(subtotal)}</span>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            {t(locale, "pos.customerMoney")}
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
            style={{ minHeight: 44 }}
            inputMode="decimal"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
          />
          <div className="mt-2 text-sm text-neutral-600">
            {t(locale, "pos.change")}:{" "}
            <span className="font-semibold text-neutral-900">
              {money(Math.max(0, Number(cashReceived || 0) - subtotal))}
            </span>
          </div>
        </Modal>
      ) : null}

      {qrisModalOpen ? (
        <Modal
          title={t(locale, "pos.payWithQrisTitle")}
          onClose={() => setQrisModalOpen(false)}
          actions={
            <>
              <button
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"
                style={{ minHeight: 44 }}
                disabled={checkingOut}
                onClick={() => setQrisModalOpen(false)}
              >
                {t(locale, "pos.no")}
              </button>
              <button
                className="flex-1 rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={checkingOut}
                onClick={async () => {
                  setCheckingOut(true);
                  try {
                    const res = await apiPost<{ transaction: CreatedTx }>(
                      "/api/transactions",
                      {
                        paymentMethod: "DIGITAL",
                        ...(session?.user?.role === "CASHIER"
                          ? {}
                          : effectiveBranchId
                            ? { branchId: effectiveBranchId }
                            : {}),
                        items: cartItems.map((it) => ({
                          productId: it.productId,
                          quantity: it.qty
                        }))
                      }
                    );
                    setQrisModalOpen(false);
                    setCart({});
                    setDoneTx(res.transaction);
                  } catch (e) {
                    toast.push(t(locale, "pos.checkoutFailed"));
                  } finally {
                    setCheckingOut(false);
                  }
                }}
              >
                {t(locale, "pos.yes")}
              </button>
            </>
          }
        >
          <div className="text-sm text-neutral-700">
            {t(locale, "pos.userAlreadyPaid")}
          </div>
        </Modal>
      ) : null}

      {doneTx ? (
        <Modal
          title=""
          onClose={() => setDoneTx(null)}
          hideClose
          actions={
            <button
              className="w-full rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a]"
              style={{ minHeight: 44 }}
              onClick={() => setDoneTx(null)}
            >
              {t(locale, "pos.done")}
            </button>
          }
        >
          <div className="flex flex-col items-center text-center">
            <Image
              src="/brand/success-check.png"
              alt="Success"
              width={96}
              height={96}
              priority
              className="h-20 w-20"
            />
            <div className="mt-3 text-xl font-semibold tracking-tight text-neutral-900">
              {t(locale, "pos.paymentSuccess")}
            </div>
          </div>

          <div className="mt-4 w-fit max-w-sm mx-auto">
            <div className="grid grid-cols-[auto_14px_auto] gap-x-3 gap-y-2 text-sm">
              <div className="text-right text-neutral-600">{t(locale, "pos.payment")}</div>
              <div className="text-neutral-400">:</div>
              <div className="font-semibold text-neutral-900">
                {doneTx.paymentMethod === "CASH" ? "Cash" : "QRIS"}
              </div>

              <div className="text-right text-neutral-600">{t(locale, "pos.total")}</div>
              <div className="text-neutral-400">:</div>
              <div className="font-semibold text-neutral-900">
                {money(Number(doneTx.total))}
              </div>

              {doneTx.paymentMethod === "CASH" ? (
                <>
                  <div className="text-right text-neutral-600">{t(locale, "pos.received")}</div>
                  <div className="text-neutral-400">:</div>
                  <div className="font-semibold text-neutral-900">
                    {money(Number(doneTx.receivedAmount ?? 0))}
                  </div>

                  <div className="text-right text-neutral-600">{t(locale, "pos.change")}</div>
                  <div className="text-neutral-400">:</div>
                  <div className="font-semibold text-neutral-900">
                    {money(Number(doneTx.changeAmount ?? 0))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200">
            {doneTx.items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.productName}</div>
                  <div className="text-sm font-semibold text-neutral-700">
                    {it.quantity} × {money(Number(it.unitPrice))}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {money(Number(it.lineTotal))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}

function Modal({
  title,
  children,
  actions,
  onClose,
  hideClose
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  onClose: () => void;
  hideClose?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 md:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        {title || !hideClose ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{title}</div>
            {!hideClose ? (
              <button
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
                style={{ minHeight: 44 }}
                onClick={onClose}
              >
                Close
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={title || !hideClose ? "mt-3" : ""}>{children}</div>
        <div className="mt-4 flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

