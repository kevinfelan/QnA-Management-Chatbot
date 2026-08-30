"use client";

import { useMemo, useState } from "react";
import type { ProjectRow, QnaRow } from "@/lib/sheets";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { IconBuilding, IconLayers, IconMessage, IconTag } from "./icons";

type KeywordStat = { keyword: string; count: number };
type KategoriStat = { kategori: string; count: number };
type StatKey = "keywords" | "pertanyaan" | "kategori" | "properti";

function buildKeywordStats(qna: QnaRow[]): KeywordStat[] {
  const map = new Map<string, number>();
  for (const row of qna) {
    const keywords = new Set(
      row.kata_kunci
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
    );
    for (const keyword of keywords) {
      map.set(keyword, (map.get(keyword) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
}

function buildKategoriStats(qna: QnaRow[]): KategoriStat[] {
  const map = new Map<string, number>();
  for (const row of qna) {
    const kategori = row.kategori.trim();
    if (!kategori) continue;
    map.set(kategori, (map.get(kategori) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([kategori, count]) => ({ kategori, count }))
    .sort((a, b) => b.count - a.count || a.kategori.localeCompare(b.kategori));
}

function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-ink/50">{text}</p>;
}

function KeywordTable({ data }: { data: KeywordStat[] }) {
  if (data.length === 0) return <EmptyState text="Belum ada kata kunci." />;
  return (
    <>
      <div className="flex flex-col divide-y divide-navy/5 md:hidden">
        {data.map((row) => (
          <div key={row.keyword} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-ink/80">{row.keyword}</span>
            <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
              {row.count} QnA
            </span>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[360px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-navy/5 text-xs uppercase tracking-wide text-navy/70">
              <th className="px-3 py-2 font-semibold">Kata Kunci</th>
              <th className="px-3 py-2 font-semibold text-right">Jumlah Pertanyaan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.keyword} className="border-b border-navy/5 last:border-0">
                <td className="px-3 py-2 text-ink/80">{row.keyword}</td>
                <td className="px-3 py-2 text-right text-ink/80">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function KategoriTable({ data }: { data: KategoriStat[] }) {
  if (data.length === 0) return <EmptyState text="Belum ada kategori." />;
  return (
    <>
      <div className="flex flex-col divide-y divide-navy/5 md:hidden">
        {data.map((row) => (
          <div key={row.kategori} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-ink/80">{row.kategori}</span>
            <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-[#8D7135]">
              {row.count} QnA
            </span>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[360px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-navy/5 text-xs uppercase tracking-wide text-navy/70">
              <th className="px-3 py-2 font-semibold">Kategori</th>
              <th className="px-3 py-2 font-semibold text-right">Jumlah Pertanyaan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.kategori} className="border-b border-navy/5 last:border-0">
                <td className="px-3 py-2 text-ink/80">{row.kategori}</td>
                <td className="px-3 py-2 text-right text-ink/80">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PertanyaanTable({ data }: { data: QnaRow[] }) {
  if (data.length === 0) return <EmptyState text="Belum ada data QnA." />;
  return (
    <>
      <div className="flex flex-col divide-y divide-navy/5 md:hidden">
        {data.map((row) => (
          <div key={row.id} className="flex flex-col gap-1.5 py-3 text-sm">
            <p className="font-medium text-ink/80">{row.pertanyaan_sample || row.kata_kunci || "-"}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50">
              <span>{row.kategori || "Umum"}</span>
              <span>•</span>
              <span>{row.nama_cluster.trim() || "Umum"}</span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 font-medium ${
                  row.aktif ? "bg-teal/10 text-teal" : "bg-ink/10 text-ink/60"
                }`}
              >
                {row.aktif ? "Aktif" : "Nonaktif"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-navy/5 text-xs uppercase tracking-wide text-navy/70">
              <th className="px-3 py-2 font-semibold">Pertanyaan</th>
              <th className="px-3 py-2 font-semibold">Kategori</th>
              <th className="px-3 py-2 font-semibold">Cluster</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b border-navy/5 last:border-0">
                <td className="px-3 py-2 align-top text-ink/80">
                  {row.pertanyaan_sample || row.kata_kunci || "-"}
                </td>
                <td className="px-3 py-2 align-top text-ink/80">{row.kategori || "-"}</td>
                <td className="px-3 py-2 align-top text-ink/80">{row.nama_cluster.trim() || "Umum"}</td>
                <td className="px-3 py-2 align-top">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.aktif ? "bg-teal/10 text-teal" : "bg-ink/10 text-ink/60"
                    }`}
                  >
                    {row.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PropertiTable({ data }: { data: ProjectRow[] }) {
  if (data.length === 0) return <EmptyState text="Belum ada data project." />;
  return (
    <>
      <div className="flex flex-col divide-y divide-navy/5 md:hidden">
        {data.map((row) => (
          <div key={row.id} className="flex flex-col gap-1 py-3 text-sm">
            <p className="font-medium text-ink/80">{row.nama_cluster || "-"}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50">
              <span>{row.daerah || "-"}</span>
              <span>•</span>
              <span>{parseUrls(row.foto_url).length} foto</span>
              <span>•</span>
              <span>{parseUrls(row.video_url).length} video</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-navy/5 text-xs uppercase tracking-wide text-navy/70">
              <th className="px-3 py-2 font-semibold">Nama Cluster</th>
              <th className="px-3 py-2 font-semibold">Daerah</th>
              <th className="px-3 py-2 font-semibold text-right">Foto</th>
              <th className="px-3 py-2 font-semibold text-right">Video</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b border-navy/5 last:border-0">
                <td className="px-3 py-2 text-ink/80">{row.nama_cluster || "-"}</td>
                <td className="px-3 py-2 text-ink/80">{row.daerah || "-"}</td>
                <td className="px-3 py-2 text-right text-ink/80">{parseUrls(row.foto_url).length}</td>
                <td className="px-3 py-2 text-right text-ink/80">{parseUrls(row.video_url).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function DashboardKpiCards({
  qna,
  projects,
}: {
  qna: QnaRow[];
  projects: ProjectRow[];
}) {
  const [active, setActive] = useState<StatKey | null>(null);
  useBodyScrollLock(active !== null);

  const keywordStats = useMemo(() => buildKeywordStats(qna), [qna]);
  const kategoriStats = useMemo(() => buildKategoriStats(qna), [qna]);

  // Sengaja render sebagai <button> (bukan <div>) biar KPI card ini beneran
  // bisa diklik/tap -- buka modal berisi tabel detail data yang jadi
  // sumber angkanya, konsisten sama modal Input QnA/Database Project
  // (scroll-lock, safe-area, stop-propagation touch).
  const stats: {
    key: StatKey;
    label: string;
    value: number;
    Icon: typeof IconTag;
    gradient: string;
  }[] = [
    {
      key: "keywords",
      label: "Kata Kunci Unik",
      value: keywordStats.length,
      Icon: IconTag,
      gradient: "from-teal to-[#35553A]",
    },
    {
      key: "pertanyaan",
      label: "Pertanyaan Tersimpan",
      value: qna.length,
      Icon: IconMessage,
      gradient: "from-[#B8865A] to-[#815E3F]",
    },
    {
      key: "kategori",
      label: "Format Jawaban (Kategori)",
      value: kategoriStats.length,
      Icon: IconLayers,
      gradient: "from-gold to-[#8D7135]",
    },
    {
      key: "properti",
      label: "Database Properti",
      value: projects.length,
      Icon: IconBuilding,
      gradient: "from-navy to-[#21352A]",
    },
  ];

  const activeInfo = stats.find((s) => s.key === active);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={`rounded-xl bg-gradient-to-br p-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${s.gradient}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-white/80">{s.label}</span>
              <s.Icon className="h-5 w-5 shrink-0 text-white/70" />
            </div>
            <p className="mt-3 font-heading text-3xl font-semibold leading-tight">{s.value}</p>
          </button>
        ))}
      </div>

      {active && activeInfo && (
        <div
          className="fixed inset-0 z-50 flex h-dvh items-center justify-center bg-navy/40 px-4"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={() => setActive(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-navy/10 px-5 py-4">
              <h3 className="font-heading text-lg font-semibold text-navy">{activeInfo.label}</h3>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Tutup"
                className="rounded-full p-1 text-ink/40 hover:bg-navy/5 hover:text-ink"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              {active === "keywords" && <KeywordTable data={keywordStats} />}
              {active === "kategori" && <KategoriTable data={kategoriStats} />}
              {active === "pertanyaan" && <PertanyaanTable data={qna} />}
              {active === "properti" && <PropertiTable data={projects} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
