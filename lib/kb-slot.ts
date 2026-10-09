import type { FotoPk, ProjectPk, TipePk } from "./pk-moniprop";

/**
 * Slot jawaban telesales: kategori -> pertanyaan spesifik -> jawaban.
 *
 * Rancangan Den Mas (9 Okt 2026): knowledge base tidak lagi berupa ratusan
 * entri per cluster, melainkan sedikit pertanyaan baku yang jawabannya
 * DIBANGKITKAN dari Dashboard PK. Satu generator ditulis sekali, lalu
 * berlaku untuk seluruh ±363 project.
 *
 * Aturan gaya (permintaan Den Mas): jangan sekadar menempel data. Tiap
 * jawaban dibuka kalimat manusia, isinya data yang ditanyakan, lalu
 * ditutup keterangan jujur seperlunya -- meniru cara agent Fikri menulis:
 * santai, to the point, dan terus terang soal yang belum pasti.
 *
 * Penutup sengaja JARANG berupa pertanyaan. Pelajaran dari masa chatbot:
 * tiap pertanyaan yang dilempar menuntut jawaban yang ada rumahnya, dan
 * kalau tidak ada, percakapan melantur. Telesales manusia bisa menentukan
 * sendiri kapan waktunya bertanya.
 */

export type SlotBubble = {
  teks: string;
  /** URL foto yang ditampilkan di posisi gelembung ini. */
  foto?: string[];
};

export type SlotKategori = "Pricelist" | "Lokasi" | "Detail Project";

export type Slot = {
  id: string;
  kategori: SlotKategori;
  pertanyaan: string;
  /** null = datanya memang belum ada di PK untuk project ini. */
  bangkitkan: (p: ProjectPk) => SlotBubble[] | null;
};

// ---------------------------------------------------------------------------
// Penolong
// ---------------------------------------------------------------------------

const RUPIAH = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** "Rp 996 juta", "Rp 1,2 M" -- bentuk yang dipakai agent saat chat. */
export function rupiahRingkas(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) {
    const m = n / 1_000_000_000;
    const teks = Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return "Rp " + teks.replace(".", ",") + " M";
  }
  return "Rp " + Math.round(n / 1_000_000) + " juta";
}

/** "Rp 5.247.000" -- angka penuh, dipakai untuk cicilan. */
export function rupiahPenuh(n: number): string {
  return "Rp " + RUPIAH.format(Math.round(n));
}

/**
 * Estimasi cicilan KPR, memakai asumsi yang SAMA PERSIS dengan kalkulator
 * di dashboard PK Moniprop dan cariproperti.com: DP 5%, bunga 3% per tahun,
 * tenor 20 tahun, rumus anuitas, dibulatkan ke ribuan.
 *
 * Disamakan dengan sengaja -- kalau telesales dan dashboard menyebut angka
 * berbeda untuk unit yang sama, customer akan menagih yang lebih murah.
 */
export const ASUMSI_KPR = { dpPersen: 5, bungaPersen: 3, tahun: 20 } as const;

export function rincianCicilan(harga: number | null | undefined) {
  if (harga == null || !Number.isFinite(harga) || harga <= 0) return null;
  const dp = (harga * ASUMSI_KPR.dpPersen) / 100;
  const kredit = harga - dp;
  const bungaBulan = ASUMSI_KPR.bungaPersen / 100 / 12;
  const bulan = ASUMSI_KPR.tahun * 12;
  const mentah = (kredit * bungaBulan) / (1 - Math.pow(1 + bungaBulan, -bulan));
  return { harga, dp, kredit, bulan, cicilan: Math.round(mentah / 1000) * 1000 };
}

/**
 * Project yang cara bayarnya tercatat HANYA cash keras tidak diberi
 * estimasi cicilan -- aturan yang sama dipakai dashboard PK. Cara bayar
 * kosong TIDAK dianggap cash keras.
 */
function hanyaCashKeras(p: ProjectPk): boolean {
  const cb = (p.cara_bayar || []).map((s) => s.toLowerCase());
  if (cb.length === 0) return false;
  return cb.every((s) => s.includes("cash") && !s.includes("bertahap"));
}

const polos = (s: string | null | undefined) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Butir artikel CMS, dipecah per kalimat, dikutip apa adanya. */
function butirArtikel(html: string | null | undefined): string[] {
  const kasar = String(html || "")
    .split(/<\/(?:p|li|h\d)>|<br\s*\/?>/i)
    .map(polos)
    .filter((b) => b.length > 1 && !b.endsWith(":"));

  const keluar: string[] = [];
  for (const b of kasar)
    keluar.push(...b.split(/(?<=\.)\s+/).map((k) => k.trim()).filter((k) => k.length > 1));
  return keluar;
}

const BERANGKA = /\d+\s*(menit|km|jam)\b/i;
const TRANSPORTASI = /stasiun|krl|lrt|mrt|commuter|busway|transjakarta|terminal|bandara|whoosh|kcic/i;
const LANDMARK = /mall|rs\b|rumah sakit|hospital|sekolah|kampus|universitas|pasar|waterpark|plaza|mal\b/i;

const namaPendek = (p: ProjectPk) => p.nama.replace(/\s+(grand residence city|grand wisata)$/i, "").trim();

function barisTipe(t: TipePk): string {
  const rinci: string[] = [];
  if (t.lt != null) rinci.push("LT " + t.lt + " m²");
  if (t.lb != null) rinci.push("LB " + t.lb + " m²");
  if (t.kt != null && t.km != null) rinci.push(t.kt + " KT " + t.km + " KM");
  else if (t.kt != null) rinci.push(t.kt + " KT");
  if (t.lantai != null) rinci.push(t.lantai + " lantai");
  const harga = rupiahRingkas(t.harga);
  return (
    "• " + (t.nama || "Tipe") + " — " + rinci.join(", ") + (harga ? ". " + harga : "")
  );
}

function fotoBercaption(p: ProjectPk, cocok: RegExp): FotoPk[] {
  return (p.foto || []).filter((f) => cocok.test(String(f.caption || "")));
}

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

export const SLOT: Slot[] = [
  // ----- Pricelist ---------------------------------------------------------
  {
    id: "harga-per-tipe",
    kategori: "Pricelist",
    pertanyaan: "Harga rumah per tipe",
    bangkitkan: (p) => {
      const tipe = p.tipe || [];
      if (tipe.length === 0) {
        const min = rupiahRingkas(p.harga_min);
        if (!min) return null;
        return [
          { teks: `Di ${namaPendek(p)} harganya mulai ${min} kak 🏠` },
          { teks: "Rincian per tipenya belum aku pegang, nanti aku kabarin begitu dapat pricelist terbarunya ya." },
        ];
      }
      return [
        {
          teks:
            tipe.length === 1
              ? `${namaPendek(p)} ada satu tipe kak 🏠`
              : `${namaPendek(p)} ada ${tipe.length} tipe kak 🏠`,
        },
        { teks: tipe.map(barisTipe).join("\n") },
        { teks: "Harga sewaktu-waktu bisa berubah ya kak, jadi kalau sudah mengerucut nanti aku pastikan lagi ke tim." },
      ];
    },
  },
  {
    id: "simulasi-cicilan",
    kategori: "Pricelist",
    pertanyaan: "Simulasi cicilan",
    bangkitkan: (p) => {
      if (hanyaCashKeras(p)) {
        return [
          { teks: `Untuk ${namaPendek(p)} pembayarannya cash kak, jadi nggak ada skema cicilan bulanan.` },
        ];
      }
      const tipe = (p.tipe || []).filter((t) => t.harga != null);
      const dasar = tipe.length
        ? tipe
        : p.harga_min != null
          ? [{ nama: "Harga mulai", harga: p.harga_min } as TipePk]
          : [];
      if (dasar.length === 0) return null;

      const baris = dasar
        .map((t) => {
          const r = rincianCicilan(t.harga);
          if (!r) return null;
          return `• ${t.nama || "Tipe"} — ${rupiahRingkas(r.harga)}\n   DP ${ASUMSI_KPR.dpPersen}% ≈ ${rupiahPenuh(r.dp)}\n   cicilan ± ${rupiahPenuh(r.cicilan)}/bln`;
        })
        .filter(Boolean) as string[];

      return [
        { teks: "Aku buatkan gambaran kasarnya dulu ya kak 🙂" },
        { teks: baris.join("\n\n") },
        {
          teks:
            `Hitungan ini pakai asumsi DP ${ASUMSI_KPR.dpPersen}%, bunga ${ASUMSI_KPR.bungaPersen}% per tahun, tenor ${ASUMSI_KPR.tahun} tahun. ` +
            "Jadi sifatnya estimasi ya kak, bukan simulasi bank — angka pastinya tergantung bank dan profil kakak.",
        },
      ];
    },
  },
  {
    id: "promo",
    kategori: "Pricelist",
    pertanyaan: "Promo yang sedang berjalan",
    bangkitkan: (p) => {
      const promo = p.promo || [];
      if (promo.length === 0) return null;
      return [
        { teks: `Yang lagi jalan di ${namaPendek(p)} ini kak 🎉` },
        { teks: promo.map((x) => "• " + x).join("\n") },
        { teks: "Promo suka berubah tiap periode ya kak, nanti aku cek lagi yang paling update sebelum kakak putuskan." },
      ];
    },
  },

  // ----- Lokasi ------------------------------------------------------------
  {
    id: "alamat",
    kategori: "Lokasi",
    pertanyaan: "Alamat rumah",
    bangkitkan: (p) => {
      if (!p.alamat) return null;
      return [
        { teks: `Alamat lengkap ${namaPendek(p)} ini kak 📍` },
        { teks: p.alamat },
      ];
    },
  },
  {
    id: "akses",
    kategori: "Lokasi",
    pertanyaan: "Akses terdekat",
    bangkitkan: (p) => {
      const butir = butirArtikel(p.artikel_lokasi).filter((b) => BERANGKA.test(b));
      if (butir.length === 0) return null;
      return [
        { teks: `Dari ${namaPendek(p)} aksesnya kira-kira begini kak 📍` },
        { teks: butir.map((b) => "• " + b).join("\n") },
        { teks: "Waktu tempuhnya tergantung jam berangkat ya kak, kalau pas jam sibuk bisa lebih lama." },
      ];
    },
  },
  {
    id: "transportasi",
    kategori: "Lokasi",
    pertanyaan: "Transportasi umum terdekat",
    bangkitkan: (p) => {
      const butir = butirArtikel(p.artikel_lokasi).filter((b) => TRANSPORTASI.test(b));
      if (butir.length === 0) return null;
      return [
        { teks: "Kalau soal transportasi umum, yang terdekat ini kak 🚉" },
        { teks: butir.map((b) => "• " + b).join("\n") },
      ];
    },
  },
  {
    id: "landmark",
    kategori: "Lokasi",
    pertanyaan: "Landmark terdekat",
    bangkitkan: (p) => {
      const butir = butirArtikel(p.artikel_lokasi).filter((b) => LANDMARK.test(b));
      if (butir.length === 0) return null;
      return [
        { teks: "Yang ada di sekitarnya kak 🏙️" },
        { teks: butir.map((b) => "• " + b).join("\n") },
      ];
    },
  },
  {
    id: "pinpoint",
    kategori: "Lokasi",
    pertanyaan: "Pin point di Gmaps",
    bangkitkan: (p) => {
      if (p.latitude == null || p.longitude == null) return null;
      return [
        { teks: "Ini titik lokasinya kak, tinggal dibuka di Gmaps 📍" },
        {
          teks: `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`,
        },
        { teks: "Dari situ kakak bisa cek rute persisnya dari rumah atau kantor." },
      ];
    },
  },

  // ----- Detail Project ----------------------------------------------------
  {
    id: "foto-fasad",
    kategori: "Detail Project",
    pertanyaan: "Foto fasad",
    bangkitkan: (p) => {
      const foto = fotoBercaption(p, /fasad|facade|tampak depan/i);
      if (foto.length === 0) return null;
      return [
        { teks: `Ini tampak depan ${namaPendek(p)} kak 🏠` },
        { teks: "", foto: foto.map((f) => f.url) },
      ];
    },
  },
  {
    id: "foto-ruang",
    kategori: "Detail Project",
    pertanyaan: "Foto ruang dalam",
    bangkitkan: (p) => {
      const foto = fotoBercaption(
        p,
        /room|bedroom|living|dining|bathroom|kitchen|ruang|kamar|dapur|interior/i
      );
      if (foto.length === 0) return null;
      return [
        { teks: "Ini bagian dalamnya kak 🛋️" },
        { teks: "", foto: foto.map((f) => f.url) },
        { teks: foto.map((f) => "• " + f.caption).join("\n") },
      ];
    },
  },
  {
    id: "foto-denah",
    kategori: "Detail Project",
    pertanyaan: "Denah & siteplan",
    bangkitkan: (p) => {
      const foto = fotoBercaption(p, /siteplan|site plan|floorplan|floor plan|denah|^tipe/i);
      if (foto.length === 0) return null;
      return [
        { teks: "Ini denah dan siteplannya kak 📐" },
        { teks: "", foto: foto.map((f) => f.url) },
      ];
    },
  },
  {
    id: "detail-unit",
    kategori: "Detail Project",
    pertanyaan: "Detail unit (tipe, kamar, LB/LT)",
    bangkitkan: (p) => {
      const tipe = p.tipe || [];
      if (tipe.length === 0) return null;
      const kamar =
        p.kamar_min != null && p.kamar_max != null
          ? p.kamar_min === p.kamar_max
            ? `${p.kamar_min} kamar tidur`
            : `${p.kamar_min}–${p.kamar_max} kamar tidur`
          : null;
      return [
        { teks: `Detail unit ${namaPendek(p)} kak 🏠` },
        { teks: tipe.map(barisTipe).join("\n") },
        ...(kamar ? [{ teks: `Jadi pilihannya ada di ${kamar} ya kak.` }] : []),
      ];
    },
  },
  {
    id: "fasilitas",
    kategori: "Detail Project",
    pertanyaan: "Fasilitas kawasan",
    bangkitkan: (p) => {
      const daftar = p.fasilitas || [];
      if (daftar.length > 0) {
        return [
          { teks: `Fasilitas di ${namaPendek(p)} kak ✨` },
          { teks: daftar.map((f) => "• " + f).join("\n") },
        ];
      }
      const butir = butirArtikel(p.artikel_fasilitas);
      if (butir.length === 0) return null;
      return [
        { teks: `Fasilitas di ${namaPendek(p)} kak ✨` },
        { teks: butir.slice(0, 8).map((b) => "• " + b).join("\n") },
      ];
    },
  },
  {
    id: "developer",
    kategori: "Detail Project",
    pertanyaan: "Developer & legalitas",
    bangkitkan: (p) => {
      const dariFaq = (p.faq || []).find((f) =>
        /developer|pengembang|sertifikat|shm|legalitas|izin/i.test(f.tanya)
      );
      if (dariFaq) {
        return [{ teks: polos(dariFaq.jawab) }];
      }
      if (p.developer) {
        return [
          { teks: `${namaPendek(p)} dikembangkan oleh ${p.developer} kak.` },
          { teks: "Untuk detail legalitas dan sertifikatnya, nanti aku pastikan dulu ke tim ya." },
        ];
      }
      return null;
    },
  },
];

/** Slot yang punya jawaban untuk project ini, dikelompokkan per kategori. */
export function slotTersedia(p: ProjectPk): { kategori: SlotKategori; slot: Slot[] }[] {
  const urutan: SlotKategori[] = ["Pricelist", "Lokasi", "Detail Project"];
  return urutan
    .map((kategori) => ({
      kategori,
      slot: SLOT.filter((s) => s.kategori === kategori && s.bangkitkan(p) !== null),
    }))
    .filter((g) => g.slot.length > 0);
}
