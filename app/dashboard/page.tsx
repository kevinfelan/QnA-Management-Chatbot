import { listProjects, listQna } from "@/lib/sheets";
import GlobalSearch from "@/components/GlobalSearch";

export default async function DashboardOverviewPage() {
  const [qna, projects] = await Promise.all([listQna(), listProjects()]);

  const totalPertanyaan = qna.length;

  const uniqueKeywords = new Set(
    qna.flatMap((row) =>
      row.kata_kunci
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const uniqueKategori = new Set(
    qna.map((row) => row.kategori.trim()).filter(Boolean)
  );

  const stats = [
    { label: "Kata Kunci Unik", value: uniqueKeywords.size },
    { label: "Pertanyaan Tersimpan", value: totalPertanyaan },
    { label: "Format Jawaban (Kategori)", value: uniqueKategori.size },
    { label: "Database Properti", value: projects.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-heading text-lg font-semibold text-navy">Ringkasan</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-navy/10 bg-white p-5"
          >
            <p className="font-heading text-3xl font-semibold text-teal">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-ink/60">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-navy">Pencarian</h2>
        <GlobalSearch qna={qna} projects={projects} />
      </div>
    </div>
  );
}
