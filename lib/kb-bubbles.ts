// Memecah kolom jawaban jadi gelembung siap salin untuk telesales.
//
// Penanda di kolom jawaban lahir dari masa chatbot:
//   [BUBBLE]  -- pemisah pesan, satu gelembung satu kali kirim
//   [FOTO]    -- dulu titik sisip foto yang dilampirkan bot
//   [CAPTION] -- dulu teks yang ditempel ke caption foto terakhir
//
// [BUBBLE] tetap berguna: telesales mengirim per gelembung persis seperti
// agent mengetik. Dua penanda lainnya tinggal satu entri (qna-34) dan tidak
// ada artinya lagi buat manusia, jadi [FOTO] diterjemahkan jadi tanda bahwa
// foto project ditampilkan di situ, dan [CAPTION] cuma dibuang.

export type Gelembung = {
  teks: string;
  // true = di posisi ini foto project ditampilkan, bukan teks
  foto: boolean;
};

export function pecahGelembung(jawaban: string): Gelembung[] {
  return jawaban
    .split("[BUBBLE]")
    .map((bagian) => {
      const foto = bagian.includes("[FOTO]");
      const teks = bagian
        .replaceAll("[FOTO]", "")
        .replaceAll("[CAPTION]", "")
        .trim();
      return { teks, foto };
    })
    .filter((g) => g.teks.length > 0 || g.foto);
}

// Seluruh gelembung disambung jadi satu blok, untuk telesales yang buru-buru
// dan memilih mengirim sekali kirim.
export function gabungGelembung(gelembung: Gelembung[]): string {
  return gelembung
    .filter((g) => g.teks.length > 0)
    .map((g) => g.teks)
    .join("\n\n");
}
