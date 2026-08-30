"use client";

import { useMemo, useState } from "react";
import type { ProjectRow } from "@/lib/sheets";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import ProjectForm, { type ProjectFormValues } from "./ProjectForm";

type ProjectTableProps = {
  initialData: ProjectRow[];
};

type ClusterGroup = {
  key: string;
  label: string;
  rows: ProjectRow[];
};

function parseSpecLines(spec: string): string[] {
  return spec
    .split(/,\s*|\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function groupByCluster(rows: ProjectRow[]): ClusterGroup[] {
  const map = new Map<string, ClusterGroup>();

  for (const row of rows) {
    const label = row.nama_cluster.trim() || "Tanpa Cluster";
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

export default function ProjectTable({ initialData }: ProjectTableProps) {
  const [rows, setRows] = useState<ProjectRow[]>(initialData);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());

  useBodyScrollLock(formOpen);

  const groups = useMemo(() => groupByCluster(rows), [rows]);
  const clusterNames = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.nama_cluster.trim()).filter(Boolean))).sort(
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
        setOpenClusters((prev) => {
          const next = new Set(prev);
          next.add((created.nama_cluster.trim() || "Tanpa Cluster").toLowerCase());
          return next;
        });
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

      {groups.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white px-4 py-8 text-center text-ink/50">
          Belum ada data project.
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
                      ({group.rows.length} properti)
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
                  <div className="grid grid-cols-1 gap-4 border-t border-navy/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.rows.map((row) => {
                      const fotos = parseUrls(row.foto_url);
                      const videos = parseUrls(row.video_url);
                      const thumb = fotos.length > 0 ? fotos[0] : null;

                      return (
                        <div
                          key={row.id}
                          className="flex flex-col overflow-hidden rounded-lg border border-navy/10"
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
                            {row.daerah && (
                              <p className="text-xs font-medium uppercase tracking-wide text-teal">
                                {row.daerah}
                              </p>
                            )}
                            <div className="flex-1 text-sm text-ink/70">
                              {row.spec ? (
                                <ul className="list-disc space-y-0.5 pl-4">
                                  {parseSpecLines(row.spec).map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-ink/40">Belum ada spesifikasi.</span>
                              )}
                            </div>
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
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex h-dvh items-center justify-center bg-navy/40 px-4"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-heading text-lg font-semibold text-navy">
              {editingRow ? "Edit Project" : "Tambah Project"}
            </h3>
            <ProjectForm
              initialData={editingRow ?? undefined}
              existingClusters={clusterNames}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}
