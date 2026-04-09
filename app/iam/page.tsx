"use client";

import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { apiGet, apiPost } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import { t } from "@/lib/i18n";

type Branch = { id: string; name: string };
type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: "OWNER" | "ADMIN" | "CASHIER";
  companyId: string;
  branchId: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function IamPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "OWNER";
  const locale = session?.user?.locale;

  const branchesQ = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiGet<{ branches: Branch[] }>("/api/branches"),
    staleTime: 30_000
  });

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<{ users: UserRow[] }>("/api/users"),
    staleTime: 10_000
  });

  const branches = branchesQ.data?.branches ?? [];
  const users = usersQ.data?.users ?? [];
  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const [newBranchName, setNewBranchName] = useState("");
  const createBranch = useMutation({
    mutationFn: (input: { name: string }) =>
      apiPost<{ branch: Branch }>("/api/branches", input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["branches"] });
    }
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "CASHIER" as "CASHIER" | "ADMIN",
    branchId: ""
  });
  const [newUserPassword2, setNewUserPassword2] = useState("");
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: (input: typeof newUser) =>
      apiPost<{ user: unknown }>("/api/users", input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {t(locale, "settings.iam")}
        </h1>
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-500">
            Branches • Admins • Cashiers
          </div>
          <div className="md:hidden">
            <MobileUserMenu />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm font-semibold">Branches</div>
          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
              style={{ minHeight: 44 }}
              placeholder="New branch name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
            <button
              className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={
                createBranch.isPending || newBranchName.trim().length < 2
              }
              onClick={async () => {
                try {
                  await createBranch.mutateAsync({ name: newBranchName.trim() });
                  setNewBranchName("");
                  toast.push(t(locale, "iam.branchCreated"));
                } catch {
                  toast.push(t(locale, "iam.branchCreateFailed"));
                }
              }}
            >
              Add
            </button>
          </div>

          <div className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
            {branches.map((b) => (
              <BranchRow
                key={b.id}
                branch={b}
                onChanged={async () => {
                  await qc.invalidateQueries({ queryKey: ["branches"] });
                }}
              />
            ))}
            {branches.length === 0 && !branchesQ.isLoading ? (
              <div className="p-4 text-sm text-neutral-600">
                No branches yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm font-semibold">Create user</div>

          <div className="mt-3 grid gap-2">
            {createUserError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createUserError}
              </div>
            ) : null}
            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
              style={{ minHeight: 44 }}
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
              style={{ minHeight: 44 }}
              placeholder="Email"
              inputMode="email"
              autoComplete="email"
              value={newUser.email}
              onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
            />
            <div className="grid gap-2">
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-neutral-300 px-3 py-3 pr-12 text-base outline-none focus:border-neutral-900"
                  style={{ minHeight: 44 }}
                  placeholder="Password (min 8 chars)"
                  type={showNewUserPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser((u) => ({ ...u, password: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold"
                  style={{ minHeight: 32 }}
                  onClick={() => setShowNewUserPassword((v) => !v)}
                >
                  {showNewUserPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                placeholder="Re-type password"
                type={showNewUserPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newUserPassword2}
                onChange={(e) => setNewUserPassword2(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((u) => ({
                    ...u,
                    role: e.target.value as any,
                    branchId: e.target.value === "ADMIN" ? "" : u.branchId
                  }))
                }
              >
                <option value="CASHIER">Cashier</option>
                <option value="ADMIN">Admin</option>
              </select>

              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                value={newUser.branchId}
                disabled={newUser.role === "ADMIN"}
                onChange={(e) =>
                  setNewUser((u) => ({ ...u, branchId: e.target.value }))
                }
              >
                <option value="" disabled>
                  {newUser.role === "ADMIN" ? "No branch (Admin)" : "Select branch"}
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              <div className="font-semibold text-neutral-900">Required</div>
              <ul className="mt-2 space-y-1">
                <li className="flex items-center justify-between gap-3">
                  <span>Name</span>
                  {newUser.name.trim().length >= 2 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-500">
                      min 2 characters
                    </span>
                  )}
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Email</span>
                  {newUser.email.trim().length >= 3 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-500">
                      enter an email
                    </span>
                  )}
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Password</span>
                  {newUser.password.length >= 8 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-500">
                      min 8 characters
                    </span>
                  )}
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Re-type password</span>
                  {newUserPassword2 === newUser.password &&
                  newUser.password.length >= 8 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-500">
                      must match
                    </span>
                  )}
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Branch</span>
                  {newUser.role === "ADMIN" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      ✓
                    </span>
                  ) : newUser.branchId ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-500">
                      required for Cashier
                    </span>
                  )}
                </li>
              </ul>
            </div>

            <button
              className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={
                createUser.isPending ||
                newUser.name.trim().length < 2 ||
                newUser.email.trim().length < 3 ||
                newUser.password.length < 8 ||
                newUserPassword2 !== newUser.password ||
                (newUser.role === "CASHIER" && !newUser.branchId)
              }
              onClick={async () => {
                setCreateUserError(null);
                try {
                  await createUser.mutateAsync({
                    ...newUser,
                    name: newUser.name.trim(),
                    email: newUser.email.trim().toLowerCase(),
                    ...(newUser.role === "ADMIN" ? { branchId: undefined } : {})
                  });
                  setNewUser({
                    name: "",
                    email: "",
                    password: "",
                    role: "CASHIER",
                    branchId: ""
                  });
                  setNewUserPassword2("");
                  toast.push(t(locale, "iam.userCreated"));
                } catch (e) {
                  const msg =
                    e instanceof Error && e.message
                      ? e.message
                      : "Failed to create user";
                  setCreateUserError(msg);
                  toast.push(t(locale, "iam.userCreateFailed"));
                }
              }}
            >
              Create user
            </button>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-neutral-200 p-4">
        <div className="text-sm font-semibold">Users</div>
        <div className="mt-3 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {users.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              branches={branches}
              branchNameById={branchNameById}
              ownerReadOnly={isOwner}
              onChanged={async () => {
                await qc.invalidateQueries({ queryKey: ["users"] });
              }}
            />
          ))}
          {users.length === 0 && !usersQ.isLoading ? (
            <div className="p-4 text-sm text-neutral-600">No users.</div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function UserCard({
  u,
  branches,
  branchNameById,
  ownerReadOnly,
  onChanged
}: {
  u: UserRow;
  branches: Branch[];
  branchNameById: Map<string, string>;
  ownerReadOnly: boolean;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const locale = session?.user?.locale;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editName, setEditName] = useState(u.name ?? "");
  const [editEmail, setEditEmail] = useState(u.email ?? "");
  const [editRole, setEditRole] = useState<"ADMIN" | "CASHIER">(
    u.role === "ADMIN" ? "ADMIN" : "CASHIER"
  );
  const [editBranchId, setEditBranchId] = useState(u.branchId ?? "");

  const [resetPw, setResetPw] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">
          {u.email ?? "—"}
        </div>
        <div className="text-xs text-neutral-500">
          {u.role}
          {u.branchId ? (
            <> • {branchNameById.get(u.branchId) ?? u.branchId.slice(0, 8)}</>
          ) : null}
          {!u.isActive ? " • Disabled" : ""}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
          style={{ minHeight: 44 }}
          onClick={() => {
            setEditName(u.name ?? "");
            setEditEmail(u.email ?? "");
            setEditRole(u.role === "ADMIN" ? "ADMIN" : "CASHIER");
            setEditBranchId(u.branchId ?? "");
            setResetPw("");
            setEditing(true);
          }}
        >
          Edit
        </button>

        <button
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
          style={{ minHeight: 44 }}
          disabled={ownerReadOnly || busy || u.role === "OWNER"}
          onClick={async () => {
            if (!confirmingDelete) {
              setConfirmingDelete(true);
              window.setTimeout(() => setConfirmingDelete(false), 2000);
              return;
            }
            setBusy(true);
            try {
              const res = await fetch(`/api/users/${u.id}`, {
                method: "DELETE",
                credentials: "include"
              });
              if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Delete failed");
              }
              toast.push(t(locale, "iam.userDeleted"));
              await qc.invalidateQueries({ queryKey: ["users"] });
            } catch (e) {
              toast.push(t(locale, "iam.userDeleteFailed"));
            } finally {
              setBusy(false);
              setConfirmingDelete(false);
            }
          }}
        >
          {confirmingDelete ? "Confirm" : "Delete"}
        </button>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 md:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Edit user</div>
              <button
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold"
                style={{ minHeight: 44 }}
                onClick={() => setEditing(false)}
              >
                {t(locale, "common.close")}
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                placeholder="Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                style={{ minHeight: 44 }}
                placeholder="Email"
                inputMode="email"
                autoComplete="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                  style={{ minHeight: 44 }}
                  value={editRole}
                  onChange={(e) => {
                    const role = e.target.value as "ADMIN" | "CASHIER";
                    setEditRole(role);
                    if (role === "ADMIN") setEditBranchId("");
                  }}
                  disabled={u.role === "OWNER"}
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="ADMIN">Admin</option>
                </select>

                <select
                  className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-900"
                  style={{ minHeight: 44 }}
                  value={editBranchId}
                  onChange={(e) => setEditBranchId(e.target.value)}
                  disabled={editRole === "ADMIN"}
                >
                  <option value="" disabled>
                    {editRole === "ADMIN" ? "No branch (Admin)" : "Select branch"}
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs font-semibold text-neutral-900">
                  Reset password (optional)
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      className="w-full rounded-xl border border-neutral-300 px-3 py-3 pr-12 text-base outline-none focus:border-neutral-900"
                      style={{ minHeight: 44 }}
                      placeholder="New password"
                      type={showResetPw ? "text" : "password"}
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold"
                      style={{ minHeight: 32 }}
                      onClick={() => setShowResetPw((v) => !v)}
                    >
                      {showResetPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ minHeight: 44 }}
                  disabled={
                    busy ||
                    editName.trim().length < 2 ||
                    editEmail.trim().length < 3 ||
                    (editRole === "CASHIER" && !editBranchId) ||
                    (resetPw.length > 0 && resetPw.length < 8)
                  }
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const payload: any = {
                        name: editName.trim(),
                        email: editEmail.trim().toLowerCase(),
                        role: editRole,
                        ...(editRole === "CASHIER"
                          ? { branchId: editBranchId }
                          : { branchId: null })
                      };
                      if (resetPw.length > 0) payload.newPassword = resetPw;

                      const res = await fetch(`/api/users/${u.id}`, {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(payload)
                      });
                      if (!res.ok) {
                        const text = await res.text().catch(() => "");
                        throw new Error(text || "Update failed");
                      }
                      toast.push(t(locale, "iam.userUpdated"));
                      await onChanged();
                      setEditing(false);
                    } catch {
                      toast.push(t(locale, "iam.userUpdateFailed"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t(locale, "common.save")}
                </button>
                <button
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold"
                  style={{ minHeight: 44 }}
                  onClick={() => setEditing(false)}
                >
                  {t(locale, "common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BranchRow({
  branch,
  onChanged
}: {
  branch: Branch;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const { data: session } = useSession();
  const locale = session?.user?.locale;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(branch.name);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        {editing ? (
          <input
            className="w-56 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            style={{ minHeight: 44 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : (
          <div className="truncate text-sm font-semibold">{branch.name}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <button
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
              style={{ minHeight: 44 }}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setName(branch.name);
              }}
            >
              {t(locale, "common.cancel")}
            </button>
            <button
              className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ minHeight: 44 }}
              disabled={busy || name.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await fetch(`/api/branches/${branch.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name: name.trim() })
                  });
                  if (!res.ok) throw new Error();
                  toast.push(t(locale, "iam.branchUpdated"));
                  await onChanged();
                  setEditing(false);
                } catch {
                  toast.push(t(locale, "iam.branchUpdateFailed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t(locale, "common.save")}
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
                setBusy(true);
                try {
                  const res = await fetch(`/api/branches/${branch.id}`, {
                    method: "DELETE",
                    credentials: "include"
                  });
                  if (!res.ok) throw new Error();
                  toast.push(t(locale, "iam.branchDeleted"));
                  await onChanged();
                } catch {
                  toast.push(t(locale, "iam.branchDeleteFailed"));
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


