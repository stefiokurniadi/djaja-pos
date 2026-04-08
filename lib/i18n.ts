"use client";

import type { Locale } from "@prisma/client";

export type I18nKey =
  | "nav.cashier"
  | "nav.menu"
  | "nav.dashboard"
  | "cart.title"
  | "cart.empty"
  | "pos.payCash"
  | "pos.payQris"
  | "pos.clearCart"
  | "settings"
  | "settings.language"
  | "settings.logout"
  | "settings.iam";

const dict: Record<Locale, Record<I18nKey, string>> = {
  id: {
    "nav.cashier": "Kasir",
    "nav.menu": "Menu",
    "nav.dashboard": "Dasbor",
    "cart.title": "Keranjang",
    "cart.empty": "Ketuk item untuk menambahkan.",
    "pos.payCash": "Bayar Tunai",
    "pos.payQris": "Bayar QRIS",
    "pos.clearCart": "Kosongkan keranjang",
    settings: "Pengaturan",
    "settings.language": "Bahasa",
    "settings.logout": "Keluar",
    "settings.iam": "Manajemen User"
  },
  en: {
    "nav.cashier": "Cashier",
    "nav.menu": "Menu",
    "nav.dashboard": "Dashboard",
    "cart.title": "Cart",
    "cart.empty": "Tap an item to add it.",
    "pos.payCash": "Pay with Cash",
    "pos.payQris": "Pay with QRIS",
    "pos.clearCart": "Clear cart",
    settings: "Settings",
    "settings.language": "Language",
    "settings.logout": "Logout",
    "settings.iam": "User Management"
  }
};

export function t(locale: Locale | undefined, key: I18nKey) {
  const loc = locale ?? "id";
  return dict[loc]?.[key] ?? dict.id[key] ?? key;
}

