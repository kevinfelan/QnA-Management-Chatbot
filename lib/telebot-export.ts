import type { ProjectRow, QnaRow } from "./sheets";

// Konversi data app kita -> format Knowledge Base "Cari Properti Telebot".
//
// Format diverifikasi langsung dari file hasil Download Excel milik mereka
// (31 Agustus 2026): sheet "Knowledge Base", kolom
// ID | Category | Question | Keywords | Items_JSON.
//
// Items_JSON adalah larik gelembung jawaban:
//   {"type":"text"|"image"|"video", "content":"...", "media_url":null|"https://...", "sort_order":0}
// - gelembung teks : `content` = isi pesan, media_url null
// - gelembung media: `content` = CAPTION, media_url = URL-nya
// - `sort_order` 0-based, menentukan urutan kirim
//
// Catatan: pemisah "|||" di system prompt mereka BUKAN format file ini --
// itu cara tool search_knowledge_base menyerahkan hasil ke LLM.

export type TelebotBubble = {
  type: "text" | "image" | "video";
  content: string;
  media_url: string | null;
  sort_order: number;
};

export type TelebotEntry = {
  category: string;
  question: string;
  keywords: string;
  bubbles: TelebotBubble[];
};

export const TELEBOT_SHEET_NAME = "Knowledge Base";

// Nama agen di chatbot kantor. Jawaban di database kita ditulis dengan
// nama "Ivy" (persona simulator Test Chat di app ini), sedangkan bot kantor
// bernama Delia sesuai system prompt mereka. Penggantian sengaja dilakukan
// SAAT EXPORT saja -- data di Google Sheets tetap "Ivy" supaya Test Chat di
// app ini tidak ikut berubah nama.
const APP_AGENT_NAME = "Ivy";
export const TELEBOT_AGENT_NAME = "Delia";

function renameAgent(text: string): string {
  // \b biar cuma kena kata utuh, bukan potongan di tengah kata lain
  return text.replace(new RegExp(`\\b${APP_AGENT_NAME}\\b`, "gi"), TELEBOT_AGENT_NAME);
}

export const TELEBOT_COLUMNS = [
  "ID",
  "Category",
  "Question",
  "Keywords",
  "Items_JSON",
] as const;

function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

// pecah spec jadi baris rapi, pola sama seperti yang dipakai Ivy di TestChat
function parseSpecLines(spec: string): string[] {
  return spec
    .split(/,\s*|\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function specToText(project: ProjectRow): string {
  const header = project.daerah
    ? `${project.nama_cluster} — ${project.daerah}`
    : project.nama_cluster;
  const lines = parseSpecLines(project.spec);
  if (lines.length === 0) return header;
  return `${header}\n\n${lines.map((l) => `• ${l}`).join("\n")}`;
}

function groupByCluster(projects: ProjectRow[]): Map<string, ProjectRow[]> {
  const map = new Map<string, ProjectRow[]>();
  for (const p of projects) {
    const key = p.nama_cluster.trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

// nama cluster biasanya diawali "Cluster ..." tapi customer sering menyebut
// tanpa kata itu -- dipakai buat bikin variasi kata kunci.
function stripClusterWord(name: string): string {
  return name.replace(/^cluster\s+/i, "").trim();
}

export function buildTelebotEntries(
  qna: QnaRow[],
  projects: ProjectRow[]
): TelebotEntry[] {
  const byCluster = groupByCluster(projects);
  const entries: TelebotEntry[] = [];

  // --- 1. Tiap QnA aktif jadi satu entri ---
  // QnA nonaktif sengaja tidak diikutkan: di app kita "nonaktif" artinya
  // jangan dipakai menjawab customer, jadi kalau ikut terkirim ke Telebot
  // justru jadi hidup lagi di sana.
  for (const row of qna) {
    if (!row.aktif) continue;

    const jawaban = row.jawaban.trim();
    if (!jawaban) continue;

    // Question wajib diisi di sisi Telebot; kalau contoh pertanyaan kosong,
    // pakai kata kunci pertama sebagai gantinya biar entri tetap valid.
    const question =
      row.pertanyaan_sample.trim() ||
      row.kata_kunci.split(",")[0]?.trim() ||
      "Pertanyaan umum";

    const bubbles: TelebotBubble[] = [
      { type: "text", content: renameAgent(jawaban), media_url: null, sort_order: 0 },
    ];

    // Kalau QnA ini terikat ke satu cluster, foto unit cluster itu ikut
    // dikirim setelah teks jawabannya -- ini yang bikin bot bisa menjawab
    // "berapa harga di X?" sambil sekalian melampirkan fotonya.
    const cluster = row.nama_cluster.trim();
    const units = cluster ? byCluster.get(cluster) : undefined;
    if (units) {
      for (const unit of units) {
        for (const url of parseUrls(unit.foto_url)) {
          bubbles.push({
            type: "image",
            content: specToText(unit),
            media_url: url,
            sort_order: bubbles.length,
          });
        }
      }
    }

    entries.push({
      category: row.kategori.trim() || "UMUM",
      question,
      keywords: row.kata_kunci.trim(),
      bubbles,
    });
  }

  // --- 2. Satu entri "minta foto" per cluster ---
  // Di percakapan asli di Chatwoot, customer minta foto dan bot menjawab
  // tidak bisa. Entri ini yang menutup lubang itu: sekali terpanggil,
  // seluruh unit di cluster terkirim lengkap dengan spec + fotonya.
  for (const [cluster, units] of byCluster) {
    const bubbles: TelebotBubble[] = [];
    const short = stripClusterWord(cluster);

    bubbles.push({
      type: "text",
      content:
        units.length > 1
          ? `Siap kak! Di ${cluster} ada ${units.length} pilihan unit, aku kirimkan satu per satu ya 🏠`
          : `Siap kak, ini foto unit di ${cluster} ya 🏠`,
      media_url: null,
      sort_order: 0,
    });

    for (const unit of units) {
      const fotos = parseUrls(unit.foto_url);
      const videos = parseUrls(unit.video_url);

      if (fotos.length === 0 && videos.length === 0) {
        bubbles.push({
          type: "text",
          content: specToText(unit),
          media_url: null,
          sort_order: bubbles.length,
        });
        continue;
      }
      for (const url of fotos) {
        bubbles.push({
          type: "image",
          content: specToText(unit),
          media_url: url,
          sort_order: bubbles.length,
        });
      }
      for (const url of videos) {
        bubbles.push({
          type: "video",
          content: `Video ${unit.nama_cluster}`,
          media_url: url,
          sort_order: bubbles.length,
        });
      }
    }

    // Kata kunci sengaja dibuat spesifik "foto/gambar/video + nama cluster",
    // BUKAN nama cluster polos -- kalau polos, dia bentrok dengan QnA harga
    // yang kata kuncinya sudah memuat nama cluster yang sama.
    const keywords = [
      `foto ${short}`,
      `gambar ${short}`,
      `video ${short}`,
      `liat ${short}`,
      `lihat ${short}`,
    ]
      .map((k) => k.toLowerCase())
      .join(", ");

    entries.push({
      category: "FOTO PROPERTI",
      question: `Boleh minta foto ${cluster}?`,
      keywords,
      bubbles,
    });
  }

  return entries;
}
