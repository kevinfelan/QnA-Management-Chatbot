"use client";

import { useMemo, useState } from "react";
import type { ProjectRow, QnaRow } from "@/lib/sheets";
import type { ProjectPk } from "@/lib/pk-moniprop";
import { gabungGelembung, pecahGelembung, type Gelembung } from "@/lib/kb-bubbles";
import { cariQna } from "@/lib/kb-cari";
import { slotTersedia, type KonteksSlot, type Slot } from "@/lib/kb-slot";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

type QnaChatPopupProps = {
  cluster: string;
  qna: QnaRow[];
  projects: ProjectRow[];
  /** Project Dashboard PK milik cluster ini; kosong kalau belum dipetakan. */
  pk: ProjectPk[];
  onClose: () => void;
};

// Satu pertanyaan yang sudah dibuka telesales, lengkap dengan jawabannya.
// Disimpan bertumpuk supaya layarnya terbaca seperti riwayat percakapan --
// telesales bisa menengok lagi jawaban sebelumnya tanpa mencarinya ulang.
// Gelembung KB lama cuma menandai "di sini ada foto" dan fotonya diambil
// dari sheet Projects. Gelembung dari slot PK membawa URL-nya sendiri,
// jadi tipenya diperluas -- bukan diganti, karena keduanya hidup
// berdampingan selama entri KB lama masih dipakai.
type GelembungTampil = Gelembung & {
  fotoUrl?: string[];
  keterangan?: string[];
  judul?: string;
};

type Dibuka = {
  kunci: string;
  pertanyaan: string;
  gelembung: GelembungTampil[];
};

const KATEGORI_FOTO = "Foto & Detail Project";

// Tiga kategori utama hasil perombakan. Entri KB lama yang kategorinya
// sama digabung ke dropdown yang sama dengan slot PK.
const KATEGORI_PK: string[] = ["Pricelist", "Lokasi", "Detail Project"];

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
  pk,
  onClose,
}: QnaChatPopupProps) {
  // Kategori yang sedang dibuka di panel kiri. Lebih dari satu boleh terbuka
  // sekaligus: telesales sering bolak-balik antara Pricelist dan Lokasi
  // dalam satu percakapan, dan menutup yang satu untuk membuka yang lain
  // cuma menambah klik.
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
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

  // Nama cluster dipakai sheet kita, bukan nama panjang versi PK: agent
  // menulis "CLUSTER ARAYA LAKE" lalu kawasannya di baris berikutnya.
  const konteks: KonteksSlot = useMemo(
    () => ({ namaCluster: cluster, daerah: unit[0]?.daerah.trim() || "" }),
    [cluster, unit]
  );

  // Slot dari Dashboard PK. Satu cluster bisa memetakan ke beberapa project
  // PK (Altara), jadi slotnya dibangkitkan per project dan diberi label
  // namanya supaya telesales tahu angka itu milik varian yang mana.
  const grupSlot = useMemo(
    () =>
      pk
        .map((p) => ({ project: p, grup: slotTersedia(p, konteks) }))
        .filter((x) => x.grup.length > 0),
    [pk, konteks]
  );

  const kategoriSlot = useMemo(() => {
    const map = new Map<string, { slot: Slot; project: ProjectPk }[]>();
    for (const { project, grup } of grupSlot)
      for (const g of grup) {
        const isi = map.get(g.kategori) || [];
        isi.push(...g.slot.map((s) => ({ slot: s, project })));
        map.set(g.kategori, isi);
      }
    return map;
  }, [grupSlot]);

  // Pencarian menjangkau SELURUH QnA cluster ini, tidak dibatasi kategori
  // yang sedang dibuka -- telesales yang mengetik sedang buru-buru dan
  // tidak sedang menelusuri.
  const hasilCari = useMemo(
    () => cariQna(milikCluster, cari),
    [milikCluster, cari]
  );

  const pertanyaanPerKategori = useMemo(() => {
    const map = new Map<string, QnaRow[]>();
    for (const r of milikCluster) {
      const k = r.kategori.trim() || "Lainnya";
      const isi = map.get(k) || [];
      isi.push(r);
      map.set(k, isi);
    }
    return map;
  }, [milikCluster]);

  // Urutan kategori di panel kiri: tiga kategori utama dulu dengan urutan
  // tetap (Pricelist, Lokasi, Detail Project), lalu kategori KB lainnya
  // dari yang paling banyak isinya. Kategori utama muncul selama ada isinya,
  // dari slot PK maupun dari entri KB yang digabung ke sana -- cluster yang
  // belum ada di PK tetap mendapat Pricelist kalau punya entri cicilan.
  const daftarKategori = useMemo(() => {
    const utama = KATEGORI_PK.filter(
      (k) => kategoriSlot.has(k) || pertanyaanPerKategori.has(k)
    );
    const lain = kategori.map(([nama]) => nama).filter((n) => !KATEGORI_PK.includes(n));
    return [...utama, ...lain];
  }, [kategoriSlot, pertanyaanPerKategori, kategori]);

  function toggleKategori(kunci: string) {
    setTerbuka((prev) => {
      const next = new Set(prev);
      if (next.has(kunci)) next.delete(kunci);
      else next.add(kunci);
      return next;
    });
  }

  // Satu kategori di panel kiri: tombol bergaris panah, dibuka ke bawah
  // menampilkan daftar pertanyaannya. Kategori dari PK diberi warna hijau
  // supaya terbedakan dari kategori entri KB yang ditulis tangan.
  function itemKategori(
    kunci: string,
    label: string,
    jumlah: number,
    asal: "pk" | "kb",
    isi: React.ReactNode
  ) {
    const buka = terbuka.has(kunci);
    return (
      <div
        key={kunci}
        className={`overflow-hidden rounded-lg border ${
          asal === "pk" ? "border-teal/40 bg-teal/5" : "border-navy/10 bg-white"
        }`}
      >
        <button
          onClick={() => toggleKategori(kunci)}
          aria-expanded={buka}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-navy hover:bg-navy/5"
        >
          <span>
            {label}{" "}
            <span className="text-xs font-normal text-ink/40">{jumlah}</span>
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 shrink-0 text-navy/50 transition-transform ${
              buka ? "rotate-180" : ""
            }`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {buka && (
          <div className="flex flex-col gap-0.5 border-t border-navy/10 bg-white p-1">
            {isi}
          </div>
        )}
      </div>
    );
  }

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

  function bukaSlot(slot: Slot, project: ProjectPk) {
    const hasil = slot.bangkitkan(project, konteks);
    if (!hasil) return;
    setDibuka((prev) => [
      ...prev,
      {
        kunci: `${slot.id}-${project.cluster_id}-${prev.length}`,
        // Nama project PK ikut ditulis hanya kalau satu cluster memetakan ke
        // lebih dari satu -- supaya jelas angka ini milik varian yang mana.
        pertanyaan: pk.length > 1 ? `${slot.pertanyaan} — ${project.nama}` : slot.pertanyaan,
        gelembung: hasil.map((b) => ({
          teks: b.teks,
          foto: Boolean(b.foto && b.foto.length),
          fotoUrl: b.foto,
          keterangan: b.keterangan,
          judul: b.judul,
        })),
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

        {/* Badan: panel pemilih di KIRI, percakapan di KANAN (permintaan
            Den Mas, 9 Okt 2026). Di HP lebar layar tidak cukup untuk dua
            kolom, jadi urutannya ditumpuk: percakapan di atas, pemilih di
            bawah -- seperti sebelumnya. */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* panel pemilih */}
          <aside className="order-2 flex max-h-[42%] shrink-0 flex-col border-t border-navy/10 bg-white md:order-1 md:max-h-none md:w-80 md:border-r md:border-t-0">
            <div className="shrink-0 p-3">
              <div className="relative">
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
                  placeholder="Cari jawaban — akses, cicilan…"
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {cari.trim().length > 0 ? (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                    {hasilCari.length > 0
                      ? `${hasilCari.length} jawaban cocok`
                      : "Tidak ada yang cocok"}
                  </p>
                  <div className="flex flex-col gap-1">
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
                        Coba kata lain, atau kosongkan pencarian untuk
                        menelusuri lewat kategori.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                    Kategori pertanyaan
                  </p>

                  {/* Satu nama = satu dropdown. Pricelist, Lokasi, dan Detail
                      Project menampung slot PK sekaligus entri KB lama yang
                      digabung ke sana (keputusan Den Mas, 9 Okt 2026) --
                      slot PK di atas, entri KB di bawahnya. */}
                  {daftarKategori.map((nama) => {
                    const slotIsi = kategoriSlot.get(nama) || [];
                    const kbIsi = pertanyaanPerKategori.get(nama) || [];
                    return itemKategori(
                      nama,
                      nama,
                      slotIsi.length + kbIsi.length,
                      KATEGORI_PK.includes(nama) ? "pk" : "kb",
                      <>
                        {slotIsi.map(({ slot, project }) => (
                          <button
                            key={slot.id + "-" + project.cluster_id}
                            onClick={() => bukaSlot(slot, project)}
                            className="w-full rounded-md px-3 py-1.5 text-left text-sm text-ink hover:bg-teal/10"
                          >
                            {slot.pertanyaan}
                            {pk.length > 1 && (
                              <span className="block text-[11px] text-ink/40">
                                {project.nama}
                              </span>
                            )}
                          </button>
                        ))}
                        {slotIsi.length > 0 && kbIsi.length > 0 && (
                          <div className="mx-2 my-1 border-t border-navy/10" />
                        )}
                        {kbIsi.map((row) => (
                          <button
                            key={row.id}
                            onClick={() => buka(row)}
                            className="w-full rounded-md px-3 py-1.5 text-left text-sm text-ink hover:bg-navy/5"
                          >
                            {row.pertanyaan_sample.trim() || row.kata_kunci}
                          </button>
                        ))}
                      </>
                    );
                  })}

                  {/* Spec & foto dari sheet Projects. Untuk cluster yang
                      sudah terhubung PK, isinya sudah tercakup slot "Foto +
                      detail project", jadi tombol ini hanya muncul untuk
                      cluster yang belum ada di PK (Dharmawangsa, New
                      Senopati) -- tanpanya mereka tidak punya jalan ke foto
                      dan harga sama sekali. */}
                  {pk.length === 0 && (
                    <button
                      onClick={bukaFotoProject}
                      className="flex w-full items-center justify-between rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-left text-sm font-medium text-navy hover:bg-gold/20"
                    >
                      {KATEGORI_FOTO}
                    </button>
                  )}

                  {daftarKategori.length === 0 && (
                    <p className="px-1 text-sm text-ink/40">
                      Belum ada QnA untuk cluster ini.
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* area percakapan */}
          <div className="order-1 min-h-0 flex-1 space-y-4 overflow-y-auto bg-background px-4 py-4 md:order-2">
            {dibuka.length === 0 ? (
              <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-ink/50">
                Pilih kategori, lalu pilih pertanyaannya. Jawabannya muncul di
                sini dalam bentuk gelembung yang tinggal disalin.
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
                      <div key={i} className="flex flex-col items-end gap-1.5">
                        {g.judul && (
                          <p className="text-xs font-semibold text-navy/70">{g.judul}</p>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          {(g.fotoUrl ?? fotoProject).length === 0 ? (
                            <p className="rounded-xl bg-white px-3 py-2 text-xs text-ink/40">
                              Belum ada foto di database project.
                            </p>
                          ) : (
                            (g.fotoUrl ?? fotoProject).map((url, j) => (
                              // Dibuka ukuran penuh di tab baru supaya telesales
                              // bisa menyimpan lalu mengirimnya ke customer.
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                title="Buka ukuran penuh"
                                className="w-24"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={g.keterangan?.[j] || cluster}
                                  className="h-24 w-24 rounded-lg object-cover hover:opacity-90"
                                />
                                {g.keterangan?.[j] && (
                                  <span className="mt-0.5 block truncate text-center text-[10px] text-ink/50">
                                    {g.keterangan[j]}
                                  </span>
                                )}
                              </a>
                            ))
                          )}
                        </div>
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
        </div>
      </div>
    </div>
  );
}
