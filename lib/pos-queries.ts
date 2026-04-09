"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export type CategoryDTO = { id: string; name: string; companyId: string };
export type ProductDTO = {
  id: string;
  name: string;
  branchId: string;
  categoryId: string;
  sku: string | null;
  price: string; // Prisma Decimal serialized
  costPrice: string; // Prisma Decimal serialized
  isActive: boolean;
  category: CategoryDTO;
};

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiGet<{ categories: CategoryDTO[] }>(`/api/categories`),
    staleTime: 30_000
  });
}

export function useProducts(branchId?: string) {
  const qs = branchId ? `?branchId=${branchId}` : "";
  return useQuery({
    queryKey: ["products", branchId ?? "NONE"],
    queryFn: () => {
      if (!branchId) return Promise.resolve({ products: [] as ProductDTO[] });
      return apiGet<{ products: ProductDTO[] }>(`/api/products${qs}`);
    },
    staleTime: 10_000
  });
}

