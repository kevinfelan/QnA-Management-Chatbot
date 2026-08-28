"use client";

import { useState } from "react";
import type { ProjectRow } from "@/lib/sheets";
import ProjectForm, { type ProjectFormValues } from "./ProjectForm";

type ProjectTableProps = {
  initialData: ProjectRow[];
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function driveThumbnail(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
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

export default function ProjectTable({ initialData }: ProjectTableProps) {
  const [rows, setRows] = useState<ProjectRow[]>(initialData);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function openCreateForm() {
    setEditingRow(null);
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(row: ProjectRow) {
    setEditingRow(row);
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRow(null);
  }

  async function handleFormSubmit(values: ProjectFormValues) {
    setError(null);
    try {
      if (editingRow) {
        const updated = await apiCall<ProjectRow>(`/api/projects/${editingRow.id}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await apiCall<ProjectRow>("/api/projects", {
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

  async function handleDelete(row: ProjectRow) {
    const confirmed = window.confirm(
      `Hapus project "${row.nama_cluster}"? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setPendingDeleteId(row.id);
    setError(null);
    try {
      await apiCall(`/api/projects/${row.id}`, { method: "DELETE" });
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
          Database Project ({rows.length})
        </h2>
        <button
          onClick={openCreateForm}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90"
        >
          + Tambah Project
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white px-4 py-8 text-center text-ink/50">
          Belum ada data project.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const fotos = parseUrls(row.foto_url);
            const videos = parseUrls(row.video_url);
            const thumb = fotos.length > 0 ? driveThumbnail(fotos[0]) : null;

            return (
              <div
                key={row.id}
                className="flex flex-col overflow-hidden rounded-lg border border-navy/10 bg-white"
              >
                <div className="relative flex h-36 items-center justify-center bg-navy/5">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={row.nama_cluster}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-ink/40">Belum ada foto</span>
                  )}
                  {videos.length > 0 && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-medium text-white">
                      ▶ {videos.length} video
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <h3 className="font-heading font-semibold text-navy">
                    {row.nama_cluster}
                  </h3>
                  {row.daerah && (
                    <p className="text-xs font-medium uppercase tracking-wide text-teal">
                      {row.daerah}
                    </p>
                  )}
                  <p className="flex-1 text-sm text-ink/70">
                    {truncate(row.spec, 100) || (
                      <span className="text-ink/40">Belum ada spesifikasi.</span>
                    )}
                  </p>
                  {fotos.length > 0 && (
                    <p className="text-xs text-ink/40">{fotos.length} foto</p>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-heading text-lg font-semibold text-navy">
              {editingRow ? "Edit Project" : "Tambah Project"}
            </h3>
            <ProjectForm
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
