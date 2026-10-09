"use client";

import { useMemo, useState } from "react";
import type { ProjectRow, QnaRow } from "@/lib/sheets";
import { gabungGelembung, pecahGelembung, type Gelembung } from "@/lib/kb-bubbles";
import { cariQna } from "@/lib/kb-cari";
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
  const [cari, setCari] = useState("");

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

  // Pencarian menjangkau SELURUH QnA cluster ini, tidak dibatasi kategori
  // yang sedang dibuka -- telesales yang mengetik sedang buru-buru dan
  // tidak sedang menelusuri.
  const hasilCari = useMemo(
    () => cariQna(milikCluster, cari),
    [milikCluster, cari]
  );

  const pertanyaan = useMemo(
    () =>
      kategoriAktif === null
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
    // Sengaja TIDAK memindah kategori aktif: foto dan spec langsung muncul
    // di percakapan, jadi memindahkan pemilih ke sub-layar kosong hanya
    // menambah satu klik "kembali" sebelum telesales bisa memilih lagi.
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

        {/* pemilih: cari dulu kalau tahu mau apa, kalau tidak telusuri
            lewat kategori */}
        <div className="shrink-0 border-t border-navy/10 bg-white px-4 py-3">
          <div className="relative mb-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari jawaban — contoh: akses terdekat, cicilan, sertifikat"
              className="w-full rounded-lg border border-navy/15 py-2 pl-9 pr-9 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
            />
            {cari.length > 0 && (
              <button
                onClick={() => setCari("")}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink/40 hover:bg-navy/5 hover:text-navy"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {cari.trim().length > 0 ? (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                {hasilCari.length > 0
                  ? `${hasilCari.length} jawaban cocok`
                  : "Tidak ada yang cocok"}
              </p>
              <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {hasilCari.map(({ row }) => (
                  <button
                    key={row.id}
                    onClick={() => buka(row)}
                    className="rounded-lg border border-navy/10 px-3 py-2 text-left text-sm text-ink hover:border-teal hover:bg-teal/5"
                  >
                    {row.pertanyaan_sample.trim() || row.kata_kunci}
                    <span className="mt-0.5 block text-[11px] text-ink/40">
                      {row.kategori.trim() || "Lainnya"}
                    </span>
                  </button>
                ))}
                {hasilCari.length === 0 && (
                  <p className="text-sm text-ink/40">
                    Coba kata lain, atau telusuri lewat kategori dengan
                    mengosongkan kolom pencarian.
                  </p>
                )}
              </div>
            </>
          ) : kategoriAktif === null ? (
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
                    Belum ada pertanyaan di kategori ini.
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
