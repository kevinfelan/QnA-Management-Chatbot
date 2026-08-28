"use client";

import { useState } from "react";
import type { QnaRow } from "@/lib/sheets";
import QnaForm, { type QnaFormValues } from "./QnaForm";

type QnaTableProps = {
  initialData: QnaRow[];
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
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

      <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                  Belum ada data QnA.
                </td>
              </tr>
            )}
            {rows.map((row) => (
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

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-heading text-lg font-semibold text-navy">
              {editingRow ? "Edit QnA" : "Tambah QnA"}
            </h3>
            <QnaForm
              initialData={editingRow ?? undefined}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}
