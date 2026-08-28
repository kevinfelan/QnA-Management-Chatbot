"use client";

import { useState } from "react";

export type AdminUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
};

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Terjadi kesalahan");
  }
  return json.data;
}

export default function AdminPanel({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const newUser = await apiCall<AdminUser>("/api/admin/invite", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setUsers((prev) => [...prev, newUser]);
      setSuccess(`Undangan terkirim ke ${email.trim()}.`);
      setEmail("");
      setRole("user");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim undangan");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleRole(user: AdminUser) {
    const newRole = user.role === "admin" ? "user" : "admin";
    setPendingRoleId(user.id);
    setError(null);
    try {
      await apiCall(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah role");
    } finally {
      setPendingRoleId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-navy/10 bg-white p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold text-navy">
          Undang User Baru
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="invite-email" className="text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="invite-role" className="text-sm font-medium text-ink">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
            >
              <option value="user">User biasa</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Mengirim..." : "Kirim Undangan"}
          </button>
        </form>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="mt-3 rounded-md bg-teal/10 px-3 py-2 text-sm text-teal">{success}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-navy/5 text-xs uppercase tracking-wide text-navy/70">
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-ink/50">
                  Belum ada user.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-navy/5 last:border-0">
                <td className="px-4 py-3 text-ink/80">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-gold/20 text-gold"
                        : "bg-navy/10 text-ink/60"
                    }`}
                  >
                    {u.role === "admin" ? "Admin" : "User"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleRole(u)}
                    disabled={pendingRoleId === u.id}
                    className="rounded-md border border-navy/20 px-3 py-1 text-xs font-medium text-navy hover:bg-navy/5 disabled:opacity-50"
                  >
                    {pendingRoleId === u.id
                      ? "Memproses..."
                      : u.role === "admin"
                        ? "Jadikan User"
                        : "Jadikan Admin"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
