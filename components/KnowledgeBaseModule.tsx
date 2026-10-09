"use client";

import { useMemo, useState } from "react";
import type { ProjectRow, QnaRow } from "@/lib/sheets";
import ProjectLauncher from "./ProjectLauncher";
import QnaTable from "./QnaTable";

type KnowledgeBaseModuleProps = {
  initialQna: QnaRow[];
  initialProjects: ProjectRow[];
};

type Tab = "project" | "database";

// Knowledge Base dan Database Project disatukan jadi satu modul. Keduanya
// memandang data yang sama dari sudut berbeda: tab Project adalah layar
// kerja telesales (meniru bentuk yang akan dipakai di Moniprop), tab
// Database adalah tempat isinya disunting.
//
// Kedua daftar dipegang di sini, bukan di masing-masing tab, supaya QnA yang
// baru disunting langsung terbaca di popup telesales tanpa perlu muat ulang.
export default function KnowledgeBaseModule({
  initialQna,
  initialProjects,
}: KnowledgeBaseModuleProps) {
  const [tab, setTab] = useState<Tab>("project");
  const [qna, setQna] = useState<QnaRow[]>(initialQna);
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);

  const utamaClusters = useMemo(
    () => projects.filter((p) => p.tipe === "utama").map((p) => p.nama_cluster),
    [projects]
  );

  const tabs: { key: Tab; label: string; jumlah: number }[] = [
    { key: "project", label: "Project", jumlah: projects.length },
    { key: "database", label: "Database QnA", jumlah: qna.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-navy/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-white text-navy shadow-sm"
                : "text-ink/60 hover:text-navy"
            }`}
          >
            {t.label}{" "}
            <span className="text-xs font-normal text-ink/40">({t.jumlah})</span>
          </button>
        ))}
      </div>

      {tab === "project" ? (
        <ProjectLauncher projects={projects} setProjects={setProjects} qna={qna} />
      ) : (
        <QnaTable rows={qna} setRows={setQna} utamaClusters={utamaClusters} />
      )}
    </div>
  );
}
