"use client";

import { useMemo, useState } from "react";
import type { QnaRow } from "@/lib/sheets";
import QnaForm, { type QnaFormValues } from "./QnaForm";

type QnaTableProps = {
  initialData: QnaRow[];
};

type ClusterGroup = {
  key: string;
  label: string;
  rows: QnaRow[];
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

function groupByCluster(rows: QnaRow[]): ClusterGroup[] {
  const map = new Map<string, ClusterGroup>();

  for (const row of rows) {
    const label = row.nama_cluster.trim() || "Umum";
    const key = label.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { key, label, rows: [] });
    }
    map.get(key)!.rows.push(row);
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

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

export default function QnaTable({ initialData }: QnaTableProps) {
  const [rows, setRows] = useState<QnaRow[]>(initialData);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<QnaRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByCluster(rows), [rows]);
  const clusterNames = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.nama_cluster.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [rows]
  );
  const kategoriNames = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.kategori.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [rows]
  );

  function toggleCluster(key: string) {
    setOpenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function openCreateForm() {
    setEditingRow(null);
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(row: QnaRow) {
    setEditingRow(row);
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRow(null);
  }

  async function handleFormSubmit(values: QnaFormValues) {
    setError(null);
    try {
      if (editingRow) {
        const updated = await apiCall<QnaRow>(`/api/qna/${editingRow.id}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await apiCall<QnaRow>("/api/qna", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setRows((prev) => [...prev, created]);
        setOpenClusters((prev) => {
          const next = new Set(prev);
          next.add((created.nama_cluster.trim() || "Umum").toLowerCase());
          return next;
        });
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data");
    }
  }

  async function handleDelete(row: QnaRow) {
    const confirmed = window.confirm(
      `Hapus QnA "${row.pertanyaan_sample || row.kata_kunci}"? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setPendingDeleteId(row.id);
    setError(null);
    try {
      await apiCall(`/api/qna/${row.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-navy">
          Daftar QnA ({rows.length})
        </h2>
        <button
          onClick={openCreateForm}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90"
        >
          + Tambah QnA
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white px-4 py-8 text-center text-ink/50">
          Belum ada data QnA.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isOpen = openClusters.has(group.key);
            return (
              <div
                key={group.key}
                className="overflow-hidden rounded-lg border border-navy/10 bg-white"
              >
                <button
                  onClick={() => toggleCluster(group.key)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-navy/5"
                >
                  <span className="font-heading font-semibold text-navy">
                    {group.label}{" "}
                    <span className="text-sm font-normal text-ink/50">
                      ({group.rows.length} QnA)
                    </span>
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-5 w-5 shrink-0 text-navy/60 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isOpen && (
                  <>
                    {/* Mobile: card list stack ke bawah, gak perlu geser samping */}
                    <div className="divide-y divide-navy/5 border-t border-navy/10 md:hidden">
                      {group.rows.map((row) => (
                        <div key={row.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                              Kata Kunci
                            </p>
                            <p className="text-ink/80">{row.kata_kunci || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                              Pertanyaan
                            </p>
                            <p className="text-ink/80">{row.pertanyaan_sample || "-"}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <div>
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                                Kategori:{" "}
                              </span>
                              <span className="text-ink/80">{row.kategori || "-"}</span>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                row.aktif ? "bg-teal/10 text-teal" : "bg-ink/10 text-ink/60"
                              }`}
                            >
                              {row.aktif ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => openEditForm(row)}
                              className="flex-1 rounded-md border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy/5"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(row)}
                              disabled={pendingDeleteId === row.id}
                              className="flex-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {pendingDeleteId === row.id ? "Menghapus..." : "Hapus"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop: tabel biasa */}
                    <div className="hidden overflow-x-auto border-t border-navy/10 md:block">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-navy/10 bg-navy/5 text-xs uppercase tracking-wide text-navy/70">
                            <th className="px-4 py-3 font-semibold">Kata Kunci</th>
                            <th className="px-4 py-3 font-semibold">Pertanyaan</th>
                            <th className="px-4 py-3 font-semibold">Kategori</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.id} className="border-b border-navy/5 last:border-0">
                              <td className="px-4 py-3 align-top text-ink/80">
                                {truncate(row.kata_kunci, 40)}
                              </td>
                              <td className="px-4 py-3 align-top text-ink/80">
                                {truncate(row.pertanyaan_sample, 60)}
                              </td>
                              <td className="px-4 py-3 align-top text-ink/80">{row.kategori}</td>
                              <td className="px-4 py-3 align-top">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                    row.aktif
                                      ? "bg-teal/10 text-teal"
                                      : "bg-ink/10 text-ink/60"
                                  }`}
                                >
                                  {row.aktif ? "Aktif" : "Nonaktif"}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => openEditForm(row)}
                                    className="rounded-md border border-navy/20 px-3 py-1 text-xs font-medium text-navy hover:bg-navy/5"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(row)}
                                    disabled={pendingDeleteId === row.id}
                                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {pendingDeleteId === row.id ? "Menghapus..." : "Hapus"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-heading text-lg font-semibold text-navy">
              {editingRow ? "Edit QnA" : "Tambah QnA"}
            </h3>
            <QnaForm
              initialData={editingRow ?? undefined}
              existingClusters={clusterNames}
              existingKategori={kategoriNames}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}
