"use client";

import { useMemo, useState } from "react";
import type { ProjectRow, QnaRow } from "@/lib/sheets";
import { gabungGelembung, pecahGelembung, type Gelembung } from "@/lib/kb-bubbles";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

type QnaChatPopupProps = {
  cluster: string;
  qna: QnaRow[];
  projects: ProjectRow[];
  onClose: () => void;
};

// Satu pertanyaan yang sudah dibuka telesales, lengkap dengan jawabannya.
// Disimpan bertumpuk supaya layarnya terbaca seperti riwayat percakapan --
// telesales bisa menengok lagi jawaban sebelumnya tanpa mencarinya ulang.
type Dibuka = {
  kunci: string;
  pertanyaan: string;
  gelembung: Gelembung[];
};

const KATEGORI_FOTO = "Foto & Detail Project";

function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

export default function QnaChatPopup({
  cluster,
  qna,
  projects,
  onClose,
}: QnaChatPopupProps) {
  const [kategoriAktif, setKategoriAktif] = useState<string | null>(null);
  const [dibuka, setDibuka] = useState<Dibuka[]>([]);
  const [tersalin, setTersalin] = useState<string | null>(null);

  useBodyScrollLock(true);

  const unit = useMemo(
    () => projects.filter((p) => p.nama_cluster.trim() === cluster),
    [projects, cluster]
  );
  const fotoProject = useMemo(
    () => unit.flatMap((u) => parseUrls(u.foto_url)),
    [unit]
  );

  const milikCluster = useMemo(
    () => qna.filter((r) => r.nama_cluster.trim() === cluster && r.aktif),
    [qna, cluster]
  );

  // Kategori diurutkan dari yang paling banyak isinya -- yang paling sering
  // ditanya customer otomatis naik ke depan tanpa perlu diurutkan manual.
  const kategori = useMemo(() => {
    const hitung = new Map<string, number>();
    for (const r of milikCluster) {
      const k = r.kategori.trim() || "Lainnya";
      hitung.set(k, (hitung.get(k) || 0) + 1);
    }
    return Array.from(hitung.entries()).sort((a, b) => b[1] - a[1]);
  }, [milikCluster]);

  const pertanyaan = useMemo(
    () =>
      kategoriAktif === null || kategoriAktif === KATEGORI_FOTO
        ? []
        : milikCluster.filter(
            (r) => (r.kategori.trim() || "Lainnya") === kategoriAktif
          ),
    [milikCluster, kategoriAktif]
  );

  async function salin(teks: string, tanda: string) {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(tanda);
      window.setTimeout(() => setTersalin((t) => (t === tanda ? null : t)), 1600);
    } catch {
      setTersalin("gagal");
    }
  }

  function buka(row: QnaRow) {
    setDibuka((prev) => [
      ...prev,
      {
        kunci: `${row.id}-${prev.length}`,
        pertanyaan: row.pertanyaan_sample.trim() || row.kata_kunci,
        gelembung: pecahGelembung(row.jawaban),
      },
    ]);
  }

  function bukaFotoProject() {
    const spec = unit
      .map((u) => u.spec.trim())
      .filter(Boolean)
      .join("\n\n");
    setDibuka((prev) => [
      ...prev,
      {
        kunci: `foto-${prev.length}`,
        pertanyaan: KATEGORI_FOTO,
        gelembung: [
          { teks: spec || "Belum ada spesifikasi di database project.", foto: false },
          { teks: "", foto: true },
        ],
      },
    ]);
    setKategoriAktif(KATEGORI_FOTO);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-dvh items-end justify-center bg-navy/60 backdrop-blur-sm sm:items-center sm:px-4"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Lebar mengikuti panel analisa di dashboard Moniprop: panel besar
          yang menguasai layar, bukan kotak dialog kecil. Di HP tetap penuh
          selebar layar dan menempel ke bawah. */}
      <div className="flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:h-[88dvh] sm:rounded-2xl">
        {/* kepala */}
        <div className="flex shrink-0 items-start justify-between gap-3 bg-navy px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate font-heading font-semibold">{cluster}</p>
            <p className="truncate text-xs text-white/60">
              {unit[0]?.daerah || "—"} · {milikCluster.length} QnA siap salin
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* area percakapan */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-background px-4 py-4">
          {dibuka.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-ink/50">
              Pilih kategori di bawah, lalu pilih pertanyaannya. Jawabannya
              muncul di sini dalam bentuk gelembung yang tinggal disalin.
            </p>
          ) : (
            dibuka.map((d) => (
              <div key={d.kunci} className="space-y-2">
                {/* Sisi mengikuti WhatsApp dari sudut pandang telesales:
                    KIRI pesan masuk dari customer, KANAN yang akan dikirim
                    telesales. Jadi telesales melihat persis bentuk
                    percakapannya nanti sebelum menyalin. */}
                <div className="flex justify-start">
                  <p className="max-w-2xl rounded-2xl rounded-bl-sm bg-navy/10 px-4 py-2 text-sm text-navy">
                    {d.pertanyaan}
                  </p>
                </div>

                {d.gelembung.map((g, i) =>
                  g.foto ? (
                    <div key={i} className="flex flex-wrap justify-end gap-2">
                      {fotoProject.length === 0 ? (
                        <p className="rounded-xl bg-white px-3 py-2 text-xs text-ink/40">
                          Belum ada foto di database project.
                        </p>
                      ) : (
                        fotoProject.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt={cluster}
                            className="h-24 w-24 rounded-lg object-cover"
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    <div key={i} className="flex items-end justify-end gap-2">
                      <button
                        onClick={() => salin(g.teks, `${d.kunci}-${i}`)}
                        className="shrink-0 rounded-md border border-navy/15 bg-white px-2 py-1 text-[11px] font-medium text-navy/70 hover:bg-navy/5"
                      >
                        {tersalin === `${d.kunci}-${i}` ? "Tersalin" : "Salin"}
                      </button>
                      <p className="max-w-2xl whitespace-pre-wrap rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-ink shadow-sm">
                        {g.teks}
                      </p>
                    </div>
                  )
                )}

                {d.gelembung.filter((g) => !g.foto).length > 1 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => salin(gabungGelembung(d.gelembung), d.kunci)}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-teal underline-offset-2 hover:underline"
                    >
                      {tersalin === d.kunci
                        ? "Semua tersalin"
                        : `Salin semua (${d.gelembung.filter((g) => !g.foto).length} gelembung)`}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* pemilih: kategori dulu, baru daftar pertanyaan */}
        <div className="shrink-0 border-t border-navy/10 bg-white px-4 py-3">
          {kategoriAktif === null ? (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                Kategori pertanyaan
              </p>
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                <button
                  onClick={bukaFotoProject}
                  className="rounded-full border border-gold/50 bg-gold/10 px-3 py-1.5 text-sm font-medium text-navy hover:bg-gold/20"
                >
                  {KATEGORI_FOTO}
                </button>
                {kategori.map(([nama, jumlah]) => (
                  <button
                    key={nama}
                    onClick={() => setKategoriAktif(nama)}
                    className="rounded-full border border-navy/15 px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/5"
                  >
                    {nama}{" "}
                    <span className="text-xs font-normal text-ink/40">{jumlah}</span>
                  </button>
                ))}
                {kategori.length === 0 && (
                  <p className="text-sm text-ink/40">
                    Belum ada QnA untuk cluster ini.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setKategoriAktif(null)}
                className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-teal"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-3 w-3"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                {kategoriAktif}
              </button>
              <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {pertanyaan.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => buka(row)}
                    className="rounded-lg border border-navy/10 px-3 py-2 text-left text-sm text-ink hover:border-teal hover:bg-teal/5"
                  >
                    {row.pertanyaan_sample.trim() || row.kata_kunci}
                  </button>
                ))}
                {pertanyaan.length === 0 && (
                  <p className="text-sm text-ink/40">
                    Foto dan spesifikasi sudah ditampilkan di atas.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
