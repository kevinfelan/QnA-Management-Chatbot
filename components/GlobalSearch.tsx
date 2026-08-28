"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectRow, QnaRow } from "@/lib/sheets";

type GlobalSearchProps = {
  qna: QnaRow[];
  projects: ProjectRow[];
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

function matchesQuery(haystacks: string[], query: string): boolean {
  return haystacks.some((h) => h.toLowerCase().includes(query));
}

export default function GlobalSearch({ qna, projects }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim().toLowerCase();

  const qnaResults = useMemo(() => {
    if (!trimmedQuery) return [];
    return qna.filter((row) =>
      matchesQuery(
        [row.kata_kunci, row.pertanyaan_sample, row.jawaban, row.kategori, row.nama_cluster],
        trimmedQuery
      )
    );
  }, [qna, trimmedQuery]);

  const projectResults = useMemo(() => {
    if (!trimmedQuery) return [];
    return projects.filter((row) =>
      matchesQuery([row.nama_cluster, row.daerah, row.spec], trimmedQuery)
    );
  }, [projects, trimmedQuery]);

  const hasResults = qnaResults.length > 0 || projectResults.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari kata kunci, pertanyaan, jawaban, atau data project..."
          className="w-full rounded-md border border-navy/20 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
      </div>

      {trimmedQuery && (
        <div className="flex flex-col gap-4">
          {!hasResults && (
            <p className="rounded-lg border border-navy/10 bg-white px-4 py-6 text-center text-sm text-ink/50">
              Tidak ada hasil untuk &quot;{query.trim()}&quot;.
            </p>
          )}

          {qnaResults.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                QnA ({qnaResults.length})
              </p>
              <div className="flex flex-col gap-2">
                {qnaResults.map((row) => (
                  <Link
                    key={row.id}
                    href="/dashboard/qna"
                    className="rounded-lg border border-navy/10 bg-white p-3 text-sm transition-colors hover:border-teal/40 hover:bg-teal/5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-navy">
                        {row.pertanyaan_sample || row.kata_kunci}
                      </span>
                      {row.nama_cluster && (
                        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy/70">
                          {row.nama_cluster}
                        </span>
                      )}
                      {row.kategori && (
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-gold">
                          {row.kategori}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-ink/60">{truncate(row.jawaban, 120)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {projectResults.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                Database Project ({projectResults.length})
              </p>
              <div className="flex flex-col gap-2">
                {projectResults.map((row) => (
                  <Link
                    key={row.id}
                    href="/dashboard/projects"
                    className="rounded-lg border border-navy/10 bg-white p-3 text-sm transition-colors hover:border-teal/40 hover:bg-teal/5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-navy">{row.nama_cluster}</span>
                      {row.daerah && (
                        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy/70">
                          {row.daerah}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-ink/60">{truncate(row.spec, 120)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
