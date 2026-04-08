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
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { MobileUserMenu } from "@/components/MobileUserMenu";

export default function MenuPage() {
  const toast = useToast();
  const { data: session } = useSession();

  const branchesQ = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiGet<{ branches: { id: string; name: string }[] }>("/api/branches"),
    staleTime: 30_000
  });
  const branches = branchesQ.data?.branches ?? [];

  const [activeBranchId, setActiveBranchId] = useState<string | "ALL">("ALL");
  const effectiveBranchId =
    session?.user?.role === "CASHIER" ? session?.user?.branchId : activeBranchId;

  const { data: catData, isLoading: catsLoading } = useCategories();
  const { data: prodData, isLoading: prodsLoading } = useProducts(effectiveBranchId);

  const categories = catData?.categories ?? [];
  const products = prodData?.products ?? [];

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
        <h1 className="text-xl font-semibold tracking-tight">Menu</h1>
        <div className="flex items-center gap-2">
          {session?.user?.role !== "CASHIER" ? (
            <select
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
              style={{ minHeight: 44 }}
              value={activeBranchId}
              onChange={(e) => setActiveBranchId(e.target.value as any)}
            >
              <option value="ALL">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-neutral-500">Branch scoped</div>
          )}
          <div className="md:hidden">
            <MobileUserMenu />
          </div>
        </div>
      </div>

      {(catsLoading || prodsLoading) && (
        <p className="mt-2 text-sm text-neutral-600">Loading…</p>
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
              className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
              className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
                    ...(activeBranchId !== "ALL" ? { branchId: activeBranchId } : {})
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
            className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
              className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
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

