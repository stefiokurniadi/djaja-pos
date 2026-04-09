"use client";

import { AppShell } from "@/components/AppShell";
import { useCategories, useProducts } from "@/lib/pos-queries";
import {
  useCreateCategory,
  useCreateProduct,
  useDeleteCategory,
  useDeleteProduct,
  useUpdateCategory,
  useUpdateProduct
} from "@/lib/menu-mutations";
import { useToast } from "@/components/Toast";
import { decimalToNumber, money } from "@/lib/money";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import { t, tFmt } from "@/lib/i18n";

export default function MenuPage() {
  const toast = useToast();
  const { data: session } = useSession();
  const locale = session?.user?.locale;

  const branchesQ = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiGet<{ branches: { id: string; name: string }[] }>("/api/branches"),
    staleTime: 30_000
  });
  const branches = branchesQ.data?.branches ?? [];

  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const [copyFromBranchId, setCopyFromBranchId] = useState<string>("");
  const [copySelected, setCopySelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (session?.user?.role === "CASHIER") return;
    if (activeBranchId) return;
    if (branches.length > 0) setActiveBranchId(branches[0].id);
  }, [branches, session?.user?.role, activeBranchId]);

  const effectiveBranchId = session?.user?.role === "CASHIER" ? session?.user?.branchId : activeBranchId;

  const { data: catData, isLoading: catsLoading } = useCategories();
  const { data: prodData, isLoading: prodsLoading } = useProducts(effectiveBranchId);

  const categories = catData?.categories ?? [];
  const products = prodData?.products ?? [];

  const sourceProductsQ = useQuery({
    queryKey: ["products", "copy-source", copyFromBranchId],
    queryFn: () =>
      copyFromBranchId
        ? apiGet<{ products: any[] }>(`/api/products?branchId=${copyFromBranchId}`)
        : Promise.resolve({ products: [] as any[] }),
    enabled: Boolean(copyFromBranchId),
    staleTime: 10_000
  });
  const sourceProducts = (sourceProductsQ.data?.products ?? []) as {
    id: string;
    name: string;
    price: string;
    costPrice: string;
    isActive: boolean;
    sku: string | null;
  }[];

  const selectedProductIds = useMemo(
    () => Object.entries(copySelected).filter(([, v]) => v).map(([k]) => k),
    [copySelected]
  );

  useEffect(() => {
    if (!copyFromBranchId) {
      setCopySelected({});
      return;
    }
    // default select all active items on open
    const next: Record<string, boolean> = {};
    for (const p of sourceProducts) next[p.id] = p.isActive;
    setCopySelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyFromBranchId, sourceProductsQ.data]);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [newCategoryName, setNewCategoryName] = useState("");

  const [newProduct, setNewProduct] = useState({
    name: "",
    categoryId: "",
    price: "",
    costPrice: "",
    sku: ""
  });

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {t(locale, "nav.menu")}
        </h1>
        <div className="flex items-center gap-2">
          {session?.user?.role !== "CASHIER" ? (
            <>
              <select
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 pr-10 text-sm font-semibold"
                style={{ minHeight: 44 }}
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={!activeBranchId || branches.length < 2}
                onClick={() => {
                  setCopyFromBranchId((prev) => (prev ? "" : branches.find((b) => b.id !== activeBranchId)?.id ?? ""));
                }}
              >
                Copy Menu
              </button>
            </>
          ) : (
            <div className="text-xs text-neutral-500">Branch scoped</div>
          )}
          <div className="md:hidden">
            <MobileUserMenu />
          </div>
        </div>
      </div>

      {session?.user?.role !== "CASHIER" && copyFromBranchId ? (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold text-neutral-900">Copy menu from another branch</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
              style={{ minHeight: 44, minWidth: 220 }}
              value={copyFromBranchId}
              onChange={(e) => setCopyFromBranchId(e.target.value)}
            >
              {branches
                .filter((b) => b.id !== activeBranchId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <button
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={sourceProducts.length === 0}
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const p of sourceProducts) next[p.id] = true;
                setCopySelected(next);
              }}
            >
              Select all
            </button>
            <button
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={sourceProducts.length === 0}
              onClick={() => setCopySelected({})}
            >
              Clear
            </button>
            <button
              className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={!copyFromBranchId || !activeBranchId || selectedProductIds.length === 0}
              onClick={async () => {
                try {
                  const res = await fetch("/api/products/copy", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      fromBranchId: copyFromBranchId,
                      toBranchId: activeBranchId,
                      productIds: selectedProductIds
                    })
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(json?.error || t(locale, "menu.copyFailed"));
                  toast.push(
                    tFmt(locale, "menu.copySuccess", {
                      copied: json.copied,
                      requested: json.requested,
                      skipped: json.skipped
                    })
                  );
                } catch (e) {
                  toast.push(e instanceof Error ? e.message : t(locale, "menu.copyFailed"));
                } finally {
                  setCopyFromBranchId("");
                }
              }}
            >
              Copy into this branch
            </button>
            <button
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900"
              style={{ minHeight: 44 }}
              onClick={() => setCopyFromBranchId("")}
            >
              {t(locale, "common.cancel")}
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200">
            <div className="grid grid-cols-[44px_1fr_110px] gap-2 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600">
              <div />
              <div>Product</div>
              <div className="text-right">Price</div>
            </div>
            <div className="max-h-72 overflow-auto divide-y divide-neutral-200">
              {sourceProductsQ.isLoading ? (
                <div className="p-3 text-sm text-neutral-600">{t(locale, "menu.loading")}</div>
              ) : sourceProducts.length === 0 ? (
                <div className="p-3 text-sm text-neutral-600">No products in source branch.</div>
              ) : (
                sourceProducts.map((p) => {
                  const checked = copySelected[p.id] ?? false;
                  return (
                    <label
                      key={p.id}
                      className="grid cursor-pointer grid-cols-[44px_1fr_110px] items-center gap-2 px-3 py-2 hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setCopySelected((prev) => ({ ...prev, [p.id]: e.target.checked }))
                        }
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">
                          {p.name}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {p.isActive ? "Active" : "Inactive"}
                          {p.sku ? ` • SKU: ${p.sku}` : ""}
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-neutral-900">
                        {money(decimalToNumber(p.price))}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Selected: {selectedProductIds.length}. Products with the same SKU (if set) are skipped.
          </div>
        </div>
      ) : null}

      {(catsLoading || prodsLoading) && (
        <p className="mt-2 text-sm text-neutral-600">{t(locale, "menu.loading")}</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm font-semibold">Categories</div>

          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
              style={{ minHeight: 44 }}
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button
              className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={createCategory.isPending || newCategoryName.trim().length === 0}
              onClick={async () => {
                try {
                  await createCategory.mutateAsync({
                    name: newCategoryName.trim(),
                    ...(activeBranchId !== "ALL" ? { branchId: activeBranchId } : {})
                  } as any);
                  setNewCategoryName("");
                  toast.push("Category created");
                } catch {
                  toast.push("Failed to create category");
                }
              }}
            >
              Add
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {categories.map((c) => (
              <CategoryRow
                key={c.id}
                id={c.id}
                name={c.name}
                onRename={async (name) => {
                  try {
                    await updateCategory.mutateAsync({ id: c.id, name });
                    toast.push("Category updated");
                  } catch {
                    toast.push("Failed to update category");
                  }
                }}
                onDelete={async () => {
                  try {
                    await deleteCategory.mutateAsync({ id: c.id });
                    toast.push("Category deleted");
                  } catch {
                    toast.push("Failed to delete category");
                  }
                }}
              />
            ))}
            {categories.length === 0 && !catsLoading ? (
              <div className="text-sm text-neutral-600">
                Create your first category (e.g. Drinks, Snacks).
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm font-semibold">Products</div>

          <div className="mt-3 grid gap-2">
            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
              style={{ minHeight: 44 }}
              placeholder="Item name"
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct((p) => ({ ...p, name: e.target.value }))
              }
            />

            <select
              className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
              style={{ minHeight: 44 }}
              value={newProduct.categoryId}
              onChange={(e) =>
                setNewProduct((p) => ({ ...p, categoryId: e.target.value }))
              }
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                placeholder="Selling price"
                inputMode="decimal"
                value={newProduct.price}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, price: e.target.value }))
                }
              />
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                placeholder="Cost price"
                inputMode="decimal"
                value={newProduct.costPrice}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, costPrice: e.target.value }))
                }
              />
            </div>

            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
              style={{ minHeight: 44 }}
              placeholder="SKU (optional)"
              value={newProduct.sku}
              onChange={(e) =>
                setNewProduct((p) => ({ ...p, sku: e.target.value }))
              }
            />

            <button
              className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={
                createProduct.isPending ||
                newProduct.name.trim().length === 0 ||
                !newProduct.categoryId ||
                Number(newProduct.price) < 0 ||
                Number(newProduct.costPrice) < 0 ||
                newProduct.price.trim().length === 0 ||
                newProduct.costPrice.trim().length === 0
              }
              onClick={async () => {
                try {
                  await createProduct.mutateAsync({
                    name: newProduct.name.trim(),
                    categoryId: newProduct.categoryId,
                    price: Number(newProduct.price),
                    costPrice: Number(newProduct.costPrice),
                    sku: newProduct.sku.trim() || undefined,
                    branchId: effectiveBranchId
                  });
                  setNewProduct({
                    name: "",
                    categoryId: "",
                    price: "",
                    costPrice: "",
                    sku: ""
                  });
                  toast.push("Product created");
                } catch {
                  toast.push("Failed to create product");
                }
              }}
            >
              Add product
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {products.map((p) => {
              const unitPrice = decimalToNumber(p.price);
              const unitCost = decimalToNumber(p.costPrice);
              const profit = unitPrice - unitCost;
              return (
                <ProductRow
                  key={p.id}
                  name={p.name}
                  categoryName={categoriesById.get(p.categoryId)?.name ?? p.category?.name ?? "—"}
                  price={unitPrice}
                  costPrice={unitCost}
                  profit={profit}
                  isActive={p.isActive}
                  onToggleActive={async () => {
                    try {
                      await updateProduct.mutateAsync({ id: p.id, isActive: !p.isActive });
                      toast.push(p.isActive ? "Deactivated" : "Activated");
                    } catch {
                      toast.push("Failed to update product");
                    }
                  }}
                  onEdit={async (next) => {
                    try {
                      await updateProduct.mutateAsync({ id: p.id, ...next });
                      toast.push("Product updated");
                    } catch {
                      toast.push("Failed to update product");
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteProduct.mutateAsync({ id: p.id });
                      toast.push("Product deleted");
                    } catch {
                      toast.push("Failed to delete product");
                    }
                  }}
                />
              );
            })}
            {products.length === 0 && !prodsLoading ? (
              <div className="text-sm text-neutral-600">
                Add products to show them in Cashier.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function CategoryRow({
  id,
  name,
  onRename,
  onDelete
}: {
  id: string;
  name: string;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            style={{ minHeight: 44 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <div className="truncate text-sm font-medium">{name}</div>
        )}
        <div className="text-xs text-neutral-500">ID: {id.slice(0, 8)}</div>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
            style={{ minHeight: 44 }}
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setValue(name);
            }}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-[#469d98] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
            style={{ minHeight: 44 }}
            disabled={busy || value.trim().length === 0 || value.trim() === name}
            onClick={async () => {
              setBusy(true);
              await onRename(value.trim());
              setBusy(false);
              setEditing(false);
            }}
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
            style={{ minHeight: 44 }}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            style={{ minHeight: 44 }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  name,
  categoryName,
  price,
  costPrice,
  profit,
  isActive,
  onToggleActive,
  onEdit,
  onDelete
}: {
  name: string;
  categoryName: string;
  price: number;
  costPrice: number;
  profit: number;
  isActive: boolean;
  onToggleActive: () => Promise<void>;
  onEdit: (next: { name?: string; price?: number; costPrice?: number }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(name);
  const [p, setP] = useState(String(price));
  const [c, setC] = useState(String(costPrice));

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {editing ? (
              <input
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                value={n}
                onChange={(e) => setN(e.target.value)}
              />
            ) : (
              name
            )}
          </div>
          <div className="mt-1 text-xs text-neutral-500">{categoryName}</div>
        </div>

        <button
          className={`rounded-full border px-3 py-2 text-sm font-semibold ${
            isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-neutral-200 bg-neutral-50 text-neutral-600"
          }`}
          style={{ minHeight: 44 }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onToggleActive();
            setBusy(false);
          }}
        >
          {isActive ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-neutral-200 p-2">
          <div className="text-neutral-500">Price</div>
          <div className="mt-1 text-sm font-semibold">
            {editing ? (
              <input
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                inputMode="decimal"
                value={p}
                onChange={(e) => setP(e.target.value)}
              />
            ) : (
              money(price)
            )}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-2">
          <div className="text-neutral-500">Cost</div>
          <div className="mt-1 text-sm font-semibold">
            {editing ? (
              <input
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                inputMode="decimal"
                value={c}
                onChange={(e) => setC(e.target.value)}
              />
            ) : (
              money(costPrice)
            )}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-2">
          <div className="text-neutral-500">Profit</div>
          <div className="mt-1 text-sm font-semibold">{money(profit)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
              style={{ minHeight: 44 }}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setN(name);
                setP(String(price));
                setC(String(costPrice));
              }}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-[#469d98] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={busy || n.trim().length === 0}
              onClick={async () => {
                setBusy(true);
                await onEdit({
                  name: n.trim(),
                  price: Number(p),
                  costPrice: Number(c)
                });
                setBusy(false);
                setEditing(false);
              }}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <button
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
              style={{ minHeight: 44 }}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
              style={{ minHeight: 44 }}
              onClick={onDelete}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

