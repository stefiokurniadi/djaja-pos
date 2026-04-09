"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text().catch(() => ""));
  return (await res.json()) as T;
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await res.text().catch(() => ""));
  return (await res.json()) as T;
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      apiPost<{ category: unknown }>("/api/categories", input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      apiPatch<{ category: unknown }>(`/api/categories/${input.id}`, {
        name: input.name
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) =>
      apiDelete<{ ok: true }>(`/api/categories/${input.id}`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["categories"] }),
        qc.invalidateQueries({ queryKey: ["products"] })
      ]);
    }
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      categoryId: string;
      sku?: string;
      price: number;
      costPrice: number;
      isActive?: boolean;
      branchId?: string;
    }) => apiPost<{ product: unknown }>("/api/products", input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["products"] });
    }
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      categoryId?: string;
      sku?: string | null;
      price?: number;
      costPrice?: number;
      isActive?: boolean;
    }) => apiPatch<{ product: unknown }>(`/api/products/${input.id}`, input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["products"] });
    }
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) =>
      apiDelete<{ ok: true }>(`/api/products/${input.id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["products"] });
    }
  });
}

