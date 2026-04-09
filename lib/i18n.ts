"use client";

import type { Locale } from "@prisma/client";

export type I18nKey =
  | "nav.cashier"
  | "nav.menu"
  | "nav.dashboard"
  | "nav.transactions"
  | "cart.title"
  | "cart.empty"
  | "pos.payCash"
  | "pos.payQris"
  | "pos.clearCart"
  | "pos.checkoutFailed"
  | "pos.payWithCashTitle"
  | "pos.payWithQrisTitle"
  | "pos.customerMoney"
  | "pos.userAlreadyPaid"
  | "pos.yes"
  | "pos.no"
  | "pos.confirm"
  | "pos.cancel"
  | "pos.done"
  | "pos.paymentSuccess"
  | "pos.payment"
  | "pos.total"
  | "pos.received"
  | "pos.change"
  | "settings"
  | "settings.language"
  | "settings.logout"
  | "settings.iam"
  | "transactions.adminOwnerOnly"
  | "transactions.loading"
  | "transactions.removeConfirm"
  | "transactions.failedRemove"
  | "transactions.failedEdit"
  | "transactions.remove"
  | "transactions.edit"
  | "common.close"
  | "common.save"
  | "common.cancel"
  | "menu.loading"
  | "menu.copySuccess"
  | "menu.copyFailed"
  | "iam.branchCreated"
  | "iam.branchCreateFailed"
  | "iam.userCreated"
  | "iam.userCreateFailed"
  | "iam.userDeleted"
  | "iam.userDeleteFailed"
  | "iam.userUpdated"
  | "iam.userUpdateFailed"
  | "iam.branchUpdated"
  | "iam.branchUpdateFailed"
  | "iam.branchDeleted"
  | "iam.branchDeleteFailed";

const dict: Record<Locale, Record<I18nKey, string>> = {
  id: {
    "nav.cashier": "Kasir",
    "nav.menu": "Menu",
    "nav.dashboard": "Dasbor",
    "nav.transactions": "Transaksi",
    "cart.title": "Keranjang",
    "cart.empty": "Ketuk item untuk menambahkan.",
    "pos.payCash": "Bayar Tunai",
    "pos.payQris": "Bayar QRIS",
    "pos.clearCart": "Kosongkan keranjang",
    "pos.checkoutFailed": "Gagal checkout",
    "pos.payWithCashTitle": "Bayar Tunai",
    "pos.payWithQrisTitle": "Bayar QRIS",
    "pos.customerMoney": "Uang pelanggan",
    "pos.userAlreadyPaid": "User sudah bayar?",
    "pos.yes": "Ya",
    "pos.no": "Tidak",
    "pos.confirm": "Konfirmasi",
    "pos.cancel": "Batal",
    "pos.done": "Selesai",
    "pos.paymentSuccess": "Pembayaran Berhasil",
    "pos.payment": "Pembayaran",
    "pos.total": "Total",
    "pos.received": "Diterima",
    "pos.change": "Kembalian",
    settings: "Pengaturan",
    "settings.language": "Bahasa",
    "settings.logout": "Keluar",
    "settings.iam": "Manajemen User",
    "transactions.adminOwnerOnly": "Halaman ini hanya tersedia untuk Admin/Owner.",
    "transactions.loading": "Memuat…",
    "transactions.removeConfirm": "Hapus transaksi ini? Ini akan menghapusnya dari laporan.",
    "transactions.failedRemove": "Gagal menghapus transaksi",
    "transactions.failedEdit": "Gagal mengubah transaksi",
    "transactions.remove": "Hapus Transaksi",
    "transactions.edit": "Ubah transaksi",
    "common.close": "Tutup",
    "common.save": "Simpan",
    "common.cancel": "Batal",
    "menu.loading": "Memuat…",
    "menu.copySuccess": "Berhasil menyalin {copied}/{requested} item (dilewati {skipped}).",
    "menu.copyFailed": "Gagal menyalin",
    "iam.branchCreated": "Cabang dibuat",
    "iam.branchCreateFailed": "Gagal membuat cabang (khusus OWNER)",
    "iam.userCreated": "User dibuat",
    "iam.userCreateFailed": "Gagal membuat user",
    "iam.userDeleted": "User dihapus",
    "iam.userDeleteFailed": "Gagal menghapus user",
    "iam.userUpdated": "User diperbarui",
    "iam.userUpdateFailed": "Gagal memperbarui user",
    "iam.branchUpdated": "Cabang diperbarui",
    "iam.branchUpdateFailed": "Gagal memperbarui cabang",
    "iam.branchDeleted": "Cabang dihapus",
    "iam.branchDeleteFailed": "Gagal menghapus cabang"
  },
  en: {
    "nav.cashier": "Cashier",
    "nav.menu": "Menu",
    "nav.dashboard": "Dashboard",
    "nav.transactions": "Transaction List",
    "cart.title": "Cart",
    "cart.empty": "Tap an item to add it.",
    "pos.payCash": "Pay with Cash",
    "pos.payQris": "Pay with QRIS",
    "pos.clearCart": "Clear cart",
    "pos.checkoutFailed": "Checkout failed",
    "pos.payWithCashTitle": "Pay with Cash",
    "pos.payWithQrisTitle": "Pay with QRIS",
    "pos.customerMoney": "Customer money",
    "pos.userAlreadyPaid": "User already paid?",
    "pos.yes": "Yes",
    "pos.no": "No",
    "pos.confirm": "Confirm",
    "pos.cancel": "Cancel",
    "pos.done": "Done",
    "pos.paymentSuccess": "Payment Success",
    "pos.payment": "Payment",
    "pos.total": "Total",
    "pos.received": "Received",
    "pos.change": "Change",
    settings: "Settings",
    "settings.language": "Language",
    "settings.logout": "Logout",
    "settings.iam": "User Management",
    "transactions.adminOwnerOnly": "This page is only available for Admin/Owner.",
    "transactions.loading": "Loading…",
    "transactions.removeConfirm": "Remove this transaction? This will remove it from reports.",
    "transactions.failedRemove": "Failed to remove transaction",
    "transactions.failedEdit": "Failed to edit transaction",
    "transactions.remove": "Remove Transaction",
    "transactions.edit": "Edit transaction",
    "common.close": "Close",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "menu.loading": "Loading…",
    "menu.copySuccess": "Copied {copied}/{requested} items (skipped {skipped}).",
    "menu.copyFailed": "Copy failed",
    "iam.branchCreated": "Branch created",
    "iam.branchCreateFailed": "Failed to create branch (OWNER only)",
    "iam.userCreated": "User created",
    "iam.userCreateFailed": "Failed to create user",
    "iam.userDeleted": "User deleted",
    "iam.userDeleteFailed": "Failed to delete user",
    "iam.userUpdated": "User updated",
    "iam.userUpdateFailed": "Failed to update user",
    "iam.branchUpdated": "Branch updated",
    "iam.branchUpdateFailed": "Failed to update branch",
    "iam.branchDeleted": "Branch deleted",
    "iam.branchDeleteFailed": "Failed to delete branch"
  }
};

export function t(locale: Locale | undefined, key: I18nKey) {
  const loc = locale ?? "id";
  return dict[loc]?.[key] ?? dict.id[key] ?? key;
}

export function tFmt(
  locale: Locale | undefined,
  key: I18nKey,
  vars: Record<string, string | number>
) {
  const s = t(locale, key);
  return s.replace(/\{(\w+)\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
  );
}

