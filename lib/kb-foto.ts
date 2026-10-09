import type { FotoPk, ProjectPk } from "./pk-moniprop";
import type { ProjectRow } from "./sheets";
import { slotTersedia, type KonteksSlot } from "./kb-slot";

export function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

// Kata yang membentuk label ruang di nama berkas foto unggahan app ini,
// mis. "cluster-visala--bedroom-visala-2-r4885v.jpg". Sisanya nama project
// (kadang salah ketik, "neuone") dan kode acak, jadi dibuang.
const KATA_RUANG =
  /^(fasad|facade|living|dining|table|room|kitchen|bathroom|bedroom|master|work|backyard|balcony|carport|garden|taman|kamar|ruang|tamu|makan|tidur|mandi|dapur)$/;

function captionDariBerkas(url: string): string {
  const berkas = decodeURIComponent(url.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
  const kata = (berkas.split("--").pop() || "").split("-").slice(0, -1);
  const label: string[] = [];
  for (const k of kata) {
    if (!KATA_RUANG.test(k)) break;
    label.push(k);
  }
  if (label.length === 0) return "Foto";
  const nomor = kata.find((k) => /^\d$/.test(k));
  const teks = label.map((k) => k[0].toUpperCase() + k.slice(1)).join(" ");
  return nomor ? teks + " " + nomor : teks;
}

/**
 * Foto yang diunggah lewat app ini (kolom foto_url sheet Projects) ikut
 * digabung ke foto PK. Isinya justru yang sering tidak ada di PK: ruang
 * tamu, kamar, dapur. Dengan begini semua slot foto -- fasad, ruang
 * dalam, foto lengkap -- memakai keduanya tanpa perlu diubah.
 */
export function gabungFotoSheet(pk: ProjectPk[], unit: ProjectRow[]): ProjectPk[] {
  const tambahan: FotoPk[] = unit
    .flatMap((u) => parseUrls(u.foto_url))
    .map((url) => ({ url, thumb: url, caption: captionDariBerkas(url) }));
  if (tambahan.length === 0) return pk;
  return pk.map((p) => {
    const ada = new Set((p.foto || []).map((f) => f.url));
    return { ...p, foto: [...(p.foto || []), ...tambahan.filter((f) => !ada.has(f.url))] };
  });
}

/** Banyaknya jawaban PK yang tersedia untuk cluster -- sama dengan isi dropdown. */
export function jumlahSlot(pk: ProjectPk[], k: KonteksSlot): number {
  return pk.reduce(
    (n, p) => n + slotTersedia(p, k).reduce((m, g) => m + g.slot.length, 0),
    0
  );
}
