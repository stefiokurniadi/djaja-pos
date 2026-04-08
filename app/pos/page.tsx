"use client";

import { AppShell } from "@/components/AppShell";
import { useMemo, useState } from "react";
import { useCategories, useProducts } from "@/lib/pos-queries";
import { decimalToNumber, money } from "@/lib/money";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/components/Toast";
import { useSession } from "next-auth/react";
import { t } from "@/lib/i18n";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import Image from "next/image";

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
  const { data: catData, isLoading: catsLoading } = useCategories();
  const { data: prodData, isLoading: prodsLoading } = useProducts();

  const categories = catData?.categories ?? [];
  const products = prodData?.products ?? [];

  const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">(
    "ALL"
  );

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

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Cashier</h1>
        <div className="flex items-center gap-2">
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
        <section className="rounded-xl border border-neutral-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`rounded-full border px-3 py-2 text-sm font-medium ${
                activeCategoryId === "ALL"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
              style={{ minHeight: 44 }}
              onClick={() => setActiveCategoryId("ALL")}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`rounded-full border px-3 py-2 text-sm font-medium ${
                  activeCategoryId === c.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
                style={{ minHeight: 44 }}
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

            {!catsLoading && !prodsLoading && visibleProducts.length === 0 && (
              <div className="text-sm text-neutral-600">
                No active products yet. Add some in Menu.
              </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((p) => {
                const unitPrice = decimalToNumber(p.price);
                return (
                  <button
                    key={p.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
                    style={{ minHeight: 88 }}
                    onClick={() => {
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
                    <div className="text-sm font-semibold leading-tight">
                      {p.name}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {p.category?.name}
                    </div>
                    <div className="mt-2 text-sm font-medium">
                      {money(unitPrice)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <aside className="rounded-xl border border-neutral-200 p-4">
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
                      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      style={{ minHeight: 44, minWidth: 44 }}
                      onClick={() => {
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
                      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      style={{ minHeight: 44, minWidth: 44 }}
                      onClick={() => {
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
                  className="mt-3 w-full rounded-xl bg-neutral-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
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
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 disabled:opacity-60"
                  style={{ minHeight: 44 }}
                  disabled={checkingOut || cartItems.length === 0}
                  onClick={() => setQrisModalOpen(true)}
                >
                  {t(locale, "pos.payQris")}
                </button>
                <button
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700"
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
          title="Pay with Cash"
          onClose={() => setCashModalOpen(false)}
          actions={
            <>
              <button
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"
                style={{ minHeight: 44 }}
                disabled={checkingOut}
                onClick={() => setCashModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
                    toast.push("Checkout failed");
                  } finally {
                    setCheckingOut(false);
                  }
                }}
              >
                Confirm
              </button>
            </>
          }
        >
          <div className="text-sm text-neutral-600">
            Total: <span className="font-semibold text-neutral-900">{money(subtotal)}</span>
          </div>
          <label className="mt-3 block text-sm font-semibold">Customer money</label>
          <input
            className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
            style={{ minHeight: 44 }}
            inputMode="decimal"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
          />
          <div className="mt-2 text-sm text-neutral-600">
            Change:{" "}
            <span className="font-semibold text-neutral-900">
              {money(Math.max(0, Number(cashReceived || 0) - subtotal))}
            </span>
          </div>
        </Modal>
      ) : null}

      {qrisModalOpen ? (
        <Modal
          title="Pay with QRIS"
          onClose={() => setQrisModalOpen(false)}
          actions={
            <>
              <button
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"
                style={{ minHeight: 44 }}
                disabled={checkingOut}
                onClick={() => setQrisModalOpen(false)}
              >
                No
              </button>
              <button
                className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={checkingOut}
                onClick={async () => {
                  setCheckingOut(true);
                  try {
                    const res = await apiPost<{ transaction: CreatedTx }>(
                      "/api/transactions",
                      {
                        paymentMethod: "DIGITAL",
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
                    toast.push("Checkout failed");
                  } finally {
                    setCheckingOut(false);
                  }
                }}
              >
                Yes
              </button>
            </>
          }
        >
          <div className="text-sm text-neutral-700">
            User already paid?
          </div>
        </Modal>
      ) : null}

      {doneTx ? (
        <Modal
          title="Payment Success"
          onClose={() => setDoneTx(null)}
          hideClose
          actions={
            <button
              className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
              style={{ minHeight: 44 }}
              onClick={() => setDoneTx(null)}
            >
              Done
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
            <Image
              src="/brand/logo.png"
              alt="DjajaPOS"
              width={260}
              height={80}
              priority
              className="mt-2 h-12 w-auto"
            />
            <div className="mt-2 text-base font-semibold text-neutral-900">
              Payment Success
            </div>
          </div>

          <div className="text-sm text-neutral-600">
            Payment:{" "}
            <span className="font-semibold text-neutral-900">
              {doneTx.paymentMethod === "CASH" ? "Cash" : "QRIS"}
            </span>
          </div>
          <div className="mt-1 text-sm text-neutral-600">
            Total:{" "}
            <span className="font-semibold text-neutral-900">
              {money(Number(doneTx.total))}
            </span>
          </div>
          {doneTx.paymentMethod === "CASH" ? (
            <>
              <div className="mt-1 text-sm text-neutral-600">
                Received:{" "}
                <span className="font-semibold text-neutral-900">
                  {money(Number(doneTx.receivedAmount ?? 0))}
                </span>
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Change:{" "}
                <span className="font-semibold text-neutral-900">
                  {money(Number(doneTx.changeAmount ?? 0))}
                </span>
              </div>
            </>
          ) : null}

          <div className="mt-4 rounded-xl border border-neutral-200">
            {doneTx.items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.productName}</div>
                  <div className="text-xs text-neutral-500">
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
        <div className="mt-3">{children}</div>
        <div className="mt-4 flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

