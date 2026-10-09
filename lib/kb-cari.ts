import type { QnaRow } from "./sheets";

// Pencarian jawaban untuk telesales yang sedang ditunggu customer.
//
// Sengaja TIDAK menuntut seluruh kata cocok. Telesales mengetik ulang
// kalimat customer apa adanya -- "akses terdekat", "deket stasiun ga" --
// sedangkan entri di database berjudul "Ada akses transportasi umum? Dekat
// LRT atau stasiun?". Kalau semua kata wajib cocok, hasilnya kosong justru
// pada pencarian yang paling wajar. Jadi satu kata cocok sudah cukup untuk
// muncul, dan yang paling banyak cocoknya naik ke atas.
//
// Bobot per kolom mengikuti seberapa sengaja isinya ditulis:
//   pertanyaan 3 -- kalimat yang memang mewakili entri itu
//   kata kunci 2 -- disusun khusus untuk penjaringan
//   jawaban    1 -- bisa kena kebetulan, jadi paling ringan

const BOBOT_PERTANYAAN = 3;
const BOBOT_KUNCI = 2;
const BOBOT_JAWABAN = 1;

// Kata yang terlalu umum di percakapan properti: kalau ikut dihitung,
// hampir semua entri kebagian nilai dan urutannya jadi tidak berarti.
const KATA_UMUM = new Set([
  "yang", "yg", "ada", "apa", "apakah", "di", "ke", "dari", "dan", "atau",
  "itu", "ini", "untuk", "buat", "nya", "kak", "kakak", "saya", "aku",
  "mau", "bisa", "gimana", "bagaimana", "berapa", "dong", "ya", "yah",
]);

export type HasilCari = {
  row: QnaRow;
  nilai: number;
};

function normalkan(teks: string): string {
  return teks.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

export function pecahKata(kueri: string): string[] {
  const semua = normalkan(kueri)
    .split(/\s+/)
    .filter((k) => k.length >= 3);

  const penting = semua.filter((k) => !KATA_UMUM.has(k));
  // Kalau yang diketik hanya kata umum ("ada apa"), lebih baik mencarinya
  // apa adanya daripada tidak mencari sama sekali.
  return penting.length > 0 ? penting : semua;
}

export function cariQna(rows: QnaRow[], kueri: string, maks = 24): HasilCari[] {
  const kata = pecahKata(kueri);
  if (kata.length === 0) return [];

  const hasil: HasilCari[] = [];

  for (const row of rows) {
    const pertanyaan = normalkan(row.pertanyaan_sample);
    const kunci = normalkan(row.kata_kunci);
    const jawaban = normalkan(row.jawaban);

    let nilai = 0;
    for (const k of kata) {
      if (pertanyaan.includes(k)) nilai += BOBOT_PERTANYAAN;
      else if (kunci.includes(k)) nilai += BOBOT_KUNCI;
      else if (jawaban.includes(k)) nilai += BOBOT_JAWABAN;
    }

    if (nilai > 0) hasil.push({ row, nilai });
  }

  return hasil
    .sort((a, b) => {
      if (b.nilai !== a.nilai) return b.nilai - a.nilai;
      // Nilai sama: yang pertanyaannya lebih pendek didahulukan, karena
      // entri yang judulnya ringkas biasanya yang paling tepat sasaran.
      return a.row.pertanyaan_sample.length - b.row.pertanyaan_sample.length;
    })
    .slice(0, maks);
}
