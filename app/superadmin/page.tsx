"use client";

import { AppShell } from "@/components/AppShell";
import { apiGet } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type Company = { id: string; name: string; createdAt: string; updatedAt: string };
type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: "OWNER" | "ADMIN" | "CASHIER" | "SUPERADMIN";
  isActive: boolean;
  companyId: string;
  branchId: string | null;
  createdAt: string;
  company?: { name: string };
  branch?: { name: string } | null;
};

export default function SuperAdminPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isSuperAdmin =
    role === "SUPERADMIN" ||
    (session?.user?.email ?? "").toLowerCase() === "superadmin@djajapos.com";
  const qc = useQueryClient();

  const [tab, setTab] = useState<"companies" | "users">("companies");

  const companiesQ = useQuery({
    queryKey: ["sa-companies"],
    queryFn: () => apiGet<{ companies: Company[] }>("/api/superadmin/companies"),
    enabled: isSuperAdmin,
    staleTime: 10_000
  });

  const usersQ = useQuery({
    queryKey: ["sa-users"],
    queryFn: () => apiGet<{ users: UserRow[] }>("/api/superadmin/users"),
    enabled: isSuperAdmin,
    staleTime: 10_000
  });

  const companies = companiesQ.data?.companies ?? [];
  const users = usersQ.data?.users ?? [];

  const companyNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.id, c.name);
    return m;
  }, [companies]);

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Super Admin</h1>
        <div className="inline-flex overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <button
            className={`px-4 py-2 text-sm font-semibold ${
              tab === "companies" ? "bg-[#469d98] text-white" : "text-neutral-700 hover:bg-neutral-50"
            }`}
            style={{ minHeight: 44 }}
            onClick={() => setTab("companies")}
          >
            Companies
          </button>
          <button
            className={`px-4 py-2 text-sm font-semibold ${
              tab === "users" ? "bg-[#469d98] text-white" : "text-neutral-700 hover:bg-neutral-50"
            }`}
            style={{ minHeight: 44 }}
            onClick={() => setTab("users")}
          >
            Users
          </button>
        </div>
      </div>

      {status === "loading" ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          Loading…
        </div>
      ) : !isSuperAdmin ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          Forbidden.
        </div>
      ) : tab === "companies" ? (
        <CompaniesPanel
          companies={companies}
          loading={companiesQ.isLoading}
          onChanged={async () => {
            await qc.invalidateQueries({ queryKey: ["sa-companies"] });
          }}
        />
      ) : (
        <UsersPanel
          users={users}
          companies={companies}
          loading={usersQ.isLoading}
          companyNameById={companyNameById}
          onChanged={async () => {
            await qc.invalidateQueries({ queryKey: ["sa-users"] });
            await qc.invalidateQueries({ queryKey: ["sa-companies"] });
          }}
        />
      )}
    </AppShell>
  );
}

function CompaniesPanel({
  companies,
  loading,
  onChanged
}: {
  companies: Company[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-sm font-semibold text-neutral-900">Companies</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="w-72 rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
          style={{ minHeight: 44 }}
          placeholder="New company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
          style={{ minHeight: 44 }}
          disabled={busy || name.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/superadmin/companies", {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name })
              });
              if (!res.ok) throw new Error(await res.text());
              setName("");
              await onChanged();
            } finally {
              setBusy(false);
            }
          }}
        >
          Create
        </button>
      </div>

      {loading ? <div className="mt-3 text-sm text-neutral-600">Loading…</div> : null}

      <div className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
        {companies.map((c) => (
          <CompanyRow key={c.id} company={c} onChanged={onChanged} />
        ))}
        {!loading && companies.length === 0 ? (
          <div className="p-4 text-sm text-neutral-600">No companies yet.</div>
        ) : null}
      </div>
    </section>
  );
}

function CompanyRow({
  company,
  onChanged
}: {
  company: Company;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(company.name);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-neutral-900">{company.name}</div>
        <div className="mt-1 truncate text-xs text-neutral-500">ID: {company.id}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <input
              className="w-64 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#469d98]"
              style={{ minHeight: 44 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
              style={{ minHeight: 44 }}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setName(company.name);
              }}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-[#469d98] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={busy || name.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await fetch(`/api/superadmin/companies/${company.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name })
                  });
                  if (!res.ok) throw new Error(await res.text());
                  await onChanged();
                  setEditing(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <button
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
              style={{ minHeight: 44 }}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
              style={{ minHeight: 44 }}
              disabled={busy}
              onClick={async () => {
                const ok = window.confirm("Delete this company? This will delete all branches, users, and data under it.");
                if (!ok) return;
                setBusy(true);
                try {
                  const res = await fetch(`/api/superadmin/companies/${company.id}`, {
                    method: "DELETE",
                    credentials: "include"
                  });
                  if (!res.ok) throw new Error(await res.text());
                  await onChanged();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function UsersPanel({
  users,
  companies,
  companyNameById,
  loading,
  onChanged
}: {
  users: UserRow[];
  companies: Company[];
  companyNameById: Map<string, string>;
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"OWNER" | "ADMIN" | "CASHIER">("CASHIER");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editBranchId, setEditBranchId] = useState<string>("");
  const [editNewPassword, setEditNewPassword] = useState<string>("");

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "CASHIER" as "OWNER" | "ADMIN" | "CASHIER",
    companyId: ""
  });

  return (
    <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-neutral-900">Users</div>
        <button
          className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
          style={{ minHeight: 44 }}
          disabled={creating}
          onClick={() => setCreating(true)}
        >
          Create user
        </button>
      </div>

      {creating ? (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
              style={{ minHeight: 44 }}
              placeholder="Name (optional)"
              value={newUser.name}
              onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
              style={{ minHeight: 44 }}
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
              style={{ minHeight: 44 }}
              placeholder="Password (min 8)"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            />
            <select
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#469d98]"
              style={{ minHeight: 44 }}
              value={newUser.role}
              onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as any }))}
            >
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="CASHIER">CASHIER</option>
            </select>
            <select
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#469d98] md:col-span-2"
              style={{ minHeight: 44 }}
              value={newUser.companyId}
              onChange={(e) => setNewUser((p) => ({ ...p, companyId: e.target.value }))}
            >
              <option value="">Select company…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"
              style={{ minHeight: 44 }}
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={!newUser.email.trim() || newUser.password.length < 8 || !newUser.companyId}
              onClick={async () => {
                const res = await fetch("/api/superadmin/users", {
                  method: "POST",
                  credentials: "include",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(newUser)
                });
                if (!res.ok) {
                  alert(await res.text());
                  return;
                }
                setCreating(false);
                setNewUser({ name: "", email: "", password: "", role: "CASHIER", companyId: "" });
                await onChanged();
              }}
            >
              Create
            </button>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Note: creating CASHIER requires a branchId (add via DB for now).
          </div>
        </div>
      ) : null}

      {loading ? <div className="mt-3 text-sm text-neutral-600">Loading…</div> : null}

      <div className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-900">
                {u.email ?? "—"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {u.role} • {companyNameById.get(u.companyId) ?? u.companyId.slice(0, 8)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={u.role === "SUPERADMIN"}
                onClick={() => {
                  setEditing(u);
                  setEditName(u.name ?? "");
                  setEditEmail(u.email ?? "");
                  setEditRole(u.role === "SUPERADMIN" ? "ADMIN" : (u.role as any));
                  setEditIsActive(Boolean(u.isActive));
                  setEditCompanyId(u.companyId);
                  setEditBranchId(u.branchId ?? "");
                  setEditNewPassword("");
                }}
              >
                Edit
              </button>
              <button
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={u.role === "SUPERADMIN"}
                onClick={async () => {
                  const ok = window.confirm("Delete this user?");
                  if (!ok) return;
                  const res = await fetch(`/api/superadmin/users/${u.id}`, {
                    method: "DELETE",
                    credentials: "include"
                  });
                  if (!res.ok) {
                    alert(await res.text());
                    return;
                  }
                  await onChanged();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!loading && users.length === 0 ? (
          <div className="p-4 text-sm text-neutral-600">No users yet.</div>
        ) : null}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 md:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Edit user</div>
              <button
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
                style={{ minHeight: 44 }}
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                placeholder="Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                placeholder="Email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              <select
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
              >
                <option value="OWNER">OWNER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="CASHIER">CASHIER</option>
              </select>
              <select
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                value={editCompanyId}
                onChange={(e) => setEditCompanyId(e.target.value)}
              >
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                placeholder="Branch ID (required for CASHIER)"
                value={editBranchId}
                onChange={(e) => setEditBranchId(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#469d98]"
                style={{ minHeight: 44 }}
                placeholder="New password (optional)"
                type="password"
                value={editNewPassword}
                onChange={(e) => setEditNewPassword(e.target.value)}
              />

              <label className="md:col-span-2 inline-flex items-center gap-2 text-sm font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
                Active
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"
                style={{ minHeight: 44 }}
                disabled={editBusy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-[#469d98] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3f8f8a] disabled:opacity-60"
                style={{ minHeight: 44 }}
                disabled={
                  editBusy ||
                  !editing ||
                  !editEmail.trim() ||
                  !editCompanyId ||
                  (editRole === "CASHIER" && !editBranchId.trim()) ||
                  (editNewPassword.length > 0 && editNewPassword.length < 8)
                }
                onClick={async () => {
                  if (!editing) return;
                  setEditBusy(true);
                  try {
                    const res = await fetch(`/api/superadmin/users/${editing.id}`, {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        name: editName,
                        email: editEmail,
                        role: editRole,
                        isActive: editIsActive,
                        companyId: editCompanyId,
                        branchId: editRole === "CASHIER" ? editBranchId : null,
                        newPassword: editNewPassword.length > 0 ? editNewPassword : undefined
                      })
                    });
                    if (!res.ok) {
                      alert(await res.text());
                      return;
                    }
                    setEditing(null);
                    await onChanged();
                  } finally {
                    setEditBusy(false);
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

