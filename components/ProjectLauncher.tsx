"use client";

import { useMemo, useState } from "react";
import type { ProjectRow, QnaRow } from "@/lib/sheets";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import ProjectForm, { type ProjectFormValues } from "./ProjectForm";
import QnaChatPopup from "./QnaChatPopup";

type ProjectLauncherProps = {
  projects: ProjectRow[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectRow[]>>;
  qna: QnaRow[];
};

type ClusterBaris = {
  kunci: string;
  nama: string;
  daerah: string;
  unit: ProjectRow[];
  jumlahQna: number;
  utama: boolean;
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

function susunBaris(projects: ProjectRow[], qna: QnaRow[]): ClusterBaris[] {
  const map = new Map<string, ClusterBaris>();

  for (const p of projects) {
    const nama = p.nama_cluster.trim() || "Tanpa Cluster";
    const kunci = nama.toLowerCase();
    if (!map.has(kunci)) {
      map.set(kunci, {
        kunci,
        nama,
        daerah: p.daerah.trim(),
        unit: [],
        jumlahQna: 0,
        utama: false,
      });
    }
    const baris = map.get(kunci)!;
    baris.unit.push(p);
    if (p.tipe === "utama") baris.utama = true;
    if (!baris.daerah) baris.daerah = p.daerah.trim();
  }

  for (const row of qna) {
    const kunci = (row.nama_cluster.trim() || "").toLowerCase();
    const baris = map.get(kunci);
    if (baris && row.aktif) baris.jumlahQna += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama));
}

export default function ProjectLauncher({
  projects,
  setProjects,
  qna,
}: ProjectLauncherProps) {
  const [dibuka, setDibuka] = useState<string | null>(null);
  const [crossOpen, setCrossOpen] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProjectRow | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useBodyScrollLock(formOpen);

  const baris = useMemo(() => susunBaris(projects, qna), [projects, qna]);
  const utama = useMemo(() => baris.filter((b) => b.utama), [baris]);
  const cross = useMemo(() => baris.filter((b) => !b.utama), [baris]);
  const clusterNames = useMemo(
    () => baris.map((b) => b.nama),
    [baris]
  );

  function toggleCross(kunci: string) {
    setCrossOpen((prev) => {
      const next = new Set(prev);
      if (next.has(kunci)) next.delete(kunci);
      else next.add(kunci);
      return next;
    });
  }

  async function handleFormSubmit(values: ProjectFormValues) {
    setError(null);
    try {
      if (editingRow) {
        const updated = await apiCall<ProjectRow>(`/api/projects/${editingRow.id}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
        setProjects((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await apiCall<ProjectRow>("/api/projects", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setProjects((prev) => [...prev, created]);
      }
      setFormOpen(false);
      setEditingRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data");
    }
  }

  async function handleDelete(row: ProjectRow) {
    setPendingDeleteId(row.id);
    setError(null);
    try {
      await apiCall(`/api/projects/${row.id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data");
    } finally {
      setPendingDeleteId(null);
    }
  }

  // Baris cluster. Seluruh badan baris membuka popup QnA -- itu kerjaan
  // telesales sehari-hari. Tombol kelola dan panah cross-sell menghentikan
  // rambatan klik supaya tidak ikut membuka popup.
  function barisCluster(b: ClusterBaris, nested: boolean) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDibuka(b.nama)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDibuka(b.nama);
          }
        }}
        className={`flex w-full cursor-pointer items-center gap-3 text-left transition-colors hover:bg-teal/5 ${
          nested ? "px-3 py-2" : "px-4 py-3"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-heading font-semibold text-navy ${
              nested ? "text-sm" : ""
            }`}
          >
            {b.nama}
          </p>
          <p className="truncate text-xs text-ink/50">
            {b.daerah || "—"} · {b.jumlahQna} QnA
            {b.unit.length > 1 ? ` · ${b.unit.length} properti` : ""}
          </p>
        </div>

        {b.unit.map((u) => (
          <span key={u.id} className="flex shrink-0 gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingRow(u);
                setError(null);
                setFormOpen(true);
              }}
              className="rounded-md border border-navy/20 px-2 py-1 text-[11px] font-medium text-navy hover:bg-navy/5"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(u);
              }}
              disabled={pendingDeleteId === u.id}
              className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {pendingDeleteId === u.id ? "..." : "Hapus"}
            </button>
          </span>
        ))}

        {!nested && cross.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCross(b.kunci);
            }}
            aria-label="Project cross-sell"
            className="shrink-0 rounded-md p-1 text-navy/50 hover:bg-navy/5"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 transition-transform ${
                crossOpen.has(b.kunci) ? "rotate-180" : ""
              }`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60">
          Klik cluster untuk membuka QnA siap salin.
        </p>
        <button
          onClick={() => {
            setEditingRow(null);
            setError(null);
            setFormOpen(true);
          }}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90"
        >
          + Tambah Project
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {baris.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white px-4 py-8 text-center text-ink/50">
          Belum ada data project.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {utama.map((b) => (
            <div
              key={b.kunci}
              className="overflow-hidden rounded-lg border border-navy/10 bg-white"
            >
              {barisCluster(b, false)}

              {crossOpen.has(b.kunci) && cross.length > 0 && (
                <div className="border-t border-navy/10 bg-navy/[0.03] px-3 py-2">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                    Project cross-sell ({cross.length})
                  </p>
                  <div className="flex flex-col gap-1">
                    {cross.map((c) => (
                      <div
                        key={c.kunci}
                        className="overflow-hidden rounded-lg border border-navy/10 bg-white"
                      >
                        {barisCluster(c, true)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Tanpa project utama, seluruh cross-sell tidak punya induk untuk
              ditumpangi. Daripada hilang dari layar, semuanya ditampilkan
              datar disertai cara menaikkan salah satunya. */}
          {utama.length === 0 && (
            <>
              <p className="rounded-lg border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-ink/70">
                Belum ada project yang ditandai utama. Buka Edit pada salah satu
                project, lalu pilih Tipe Project = Project utama.
              </p>
              {cross.map((c) => (
                <div
                  key={c.kunci}
                  className="overflow-hidden rounded-lg border border-navy/10 bg-white"
                >
                  {barisCluster(c, false)}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {dibuka && (
        <QnaChatPopup
          cluster={dibuka}
          qna={qna}
          projects={projects}
          onClose={() => setDibuka(null)}
        />
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
              onCancel={() => {
                setFormOpen(false);
                setEditingRow(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
