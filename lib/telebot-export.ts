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

// Paling banyak 4 foto per jawaban. Sebelumnya SEMUA foto cluster dikirim
// (6 foto), masing-masing dengan caption spec lengkap -- di WhatsApp itu
// terbaca sebagai tembok informasi yang mengulang-ulang hal yang sama.
const MAKS_FOTO = 4;

// Caption ringkas bergaya agent: satu blok pendek beremoji, bukan daftar
// butir panjang. Dipakai HANYA di foto pertama; foto berikutnya tanpa caption
// supaya tidak ada spec yang terulang 4 kali.
function specToCaption(project: ProjectRow): string {
  const spec = project.spec || "";
  const baris: string[] = [
    project.daerah
      ? `🏠 ${project.nama_cluster} — ${project.daerah}`
      : `🏠 ${project.nama_cluster}`,
  ];

  const harga = spec.match(/Harga mulai [^.]+/i)?.[0];
  if (harga) baris.push(`💰 ${harga.replace(/^Harga mulai /i, "Mulai ")}`);

  const sisa = spec
    .replace(harga || "", "")
    .split(/\.\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const tipe = sisa.find((s) => /LB |LT |Tipe|T\d/i.test(s));
  if (tipe) baris.push(`📐 ${tipe}`);

  const promo = sisa.find((s) => /free|promo|diskon|bonus|utj|cara bayar/i.test(s));
  if (promo) baris.push(`✨ ${promo}`);

  return baris.join("\n");
}

// Satu video saja per jawaban. Video jauh lebih berat daripada foto dan
// sebagian besar customer membukanya lewat kuota seluler -- kirim dua video
// dalam satu jawaban itu memaksa mereka menunggu tanpa alasan.
const MAKS_VIDEO = 1;

// Video cluster, dikirim setelah foto. Agent memang mengirim video show unit,
// jadi ini melengkapi foto, bukan menggantikan.
function videoBubbles(
  units: ProjectRow[],
  mulaiDari: number
): TelebotBubble[] {
  const out: TelebotBubble[] = [];
  for (const unit of units) {
    for (const url of parseUrls(unit.video_url)) {
      if (out.length >= MAKS_VIDEO) return out;
      out.push({
        type: "video",
        content: `Video show unit ${unit.nama_cluster} 🎥`,
        media_url: url,
        sort_order: mulaiDari + out.length,
      });
    }
  }
  return out;
}

// Foto cluster dengan caption hanya di foto pertama, dibatasi MAKS_FOTO.
function fotoBubbles(
  units: ProjectRow[],
  mulaiDari: number
): TelebotBubble[] {
  const out: TelebotBubble[] = [];
  for (const unit of units) {
    for (const url of parseUrls(unit.foto_url)) {
      if (out.length >= MAKS_FOTO) return out;
      out.push({
        type: "image",
        content: out.length === 0 ? specToCaption(unit) : "",
        media_url: url,
        sort_order: mulaiDari + out.length,
      });
    }
  }
  return out;
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

// samakan bentuk pertanyaan sebelum dibandingkan, biar beda huruf besar/kecil
// atau tanda baca tidak lolos sebagai "pertanyaan berbeda"
function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ambil nama tipe rumah dari spec, mis. "Tipe Cempaka" -> "Cempaka"
function extractTipeName(spec: string): string | null {
  const m = spec.match(/Tipe\s+([A-Za-z]+(?:\s+\d+)?)/i);
  return m ? m[1].trim() : null;
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

    // Foto HANYA dilampirkan pada entri berkategori foto.
    //
    // Dulu foto ikut menempel di SEMUA entri yang terikat cluster, termasuk
    // entri harga. Sekarang itu jadi salah: teks jawabannya sudah ditulis
    // meniru gaya agent, dan ditutup dengan tawaran "Mau dikirimin fotonya
    // dulu?" -- kalau fotonya tetap terkirim otomatis, botnya menawarkan
    // sesuatu yang sudah dia lakukan sendiri. Belum lagi 5-6 foto per
    // pertanyaan harga itu berat di WhatsApp.
    // "Pembuka" ikut dapat foto: itu entri untuk customer yang membuka chat
    // cuma dengan menempel link iklan. Yang dia harapkan foto + spec, bukan
    // ceramah lokasi.
    const cluster = row.nama_cluster.trim();
    const kategoriFoto = /foto|gambar|pembuka/i.test(row.kategori);
    const units = cluster && kategoriFoto ? byCluster.get(cluster) : undefined;
    if (units) {
      bubbles.push(...fotoBubbles(units, bubbles.length));
      // video hanya di entri FOTO, bukan di entri Pembuka -- pembuka sudah
      // berisi sapaan + 4 foto + spec, menambah video di situ kelewat berat
      if (/foto|gambar/i.test(row.kategori)) {
        bubbles.push(...videoBubbles(units, bubbles.length));
      }
    }

    // Penanda [FOTO] di dalam jawaban menentukan DI MANA foto disisipkan.
    // Dipakai supaya urutan kirimnya sama seperti agent: sapa dulu, lalu
    // foto + spec, baru kalimat penggali minat. Tanpa penanda, foto selalu
    // menempel di belakang dan pertanyaan penggali minat jadi terkubur di
    // atas foto -- customer sudah keburu scroll.
    if (units && /\[FOTO\]/.test(jawaban)) {
      const [sebelum, sesudah] = renameAgent(jawaban).split(/\n*\[FOTO\]\n*/);
      const foto = fotoBubbles(units, 1);
      bubbles.length = 0;
      if (sebelum.trim())
        bubbles.push({ type: "text", content: sebelum.trim(), media_url: null, sort_order: 0 });
      for (const b of foto) bubbles.push({ ...b, sort_order: bubbles.length });
      if (sesudah && sesudah.trim())
        bubbles.push({ type: "text", content: sesudah.trim(), media_url: null, sort_order: bubbles.length });
    }

    entries.push({
      category: row.kategori.trim() || "UMUM",
      question,
      keywords: row.kata_kunci.trim(),
      bubbles,
    });
  }

  // Pertanyaan yang SUDAH dijawab oleh QnA buatan tangan. Entri otomatis di
  // bawah tidak boleh menduplikasinya.
  //
  // Ini masalah nyata, bukan teoretis: begitu knowledge base kita punya entri
  // Foto dan Lokasi per cluster, generator di bawah menghasilkan pertanyaan
  // yang bunyinya PERSIS SAMA ("Boleh minta foto Cluster Araya Lake?").
  // Pencarian Telebot berbasis kemiripan makna dan yang paling menentukan
  // adalah kolom Question -- dua baris dengan pertanyaan identik tapi isi
  // berbeda bikin jawaban bot jadi untung-untungan.
  const sudahAda = new Set(entries.map((e) => normalizeQuestion(e.question)));
  const belumAda = (q: string) => !sudahAda.has(normalizeQuestion(q));

  // --- 2. Satu entri "minta foto" per cluster ---
  // Di percakapan asli di Chatwoot, customer minta foto dan bot menjawab
  // tidak bisa. Entri ini yang menutup lubang itu: sekali terpanggil,
  // seluruh unit di cluster terkirim lengkap dengan spec + fotonya.
  for (const [cluster, units] of byCluster) {
    if (!belumAda(`Boleh minta foto ${cluster}?`)) continue;
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

    const adaFoto = units.some((u) => parseUrls(u.foto_url).length > 0);
    if (adaFoto) bubbles.push(...fotoBubbles(units, bubbles.length));

    for (const unit of units) {
      const videos = parseUrls(unit.video_url);

      if (!adaFoto && videos.length === 0) {
        bubbles.push({
          type: "text",
          content: specToCaption(unit),
          media_url: null,
          sort_order: bubbles.length,
        });
        continue;
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

  // --- 3. Satu entri per DAERAH ---
  //
  // Ini lahir dari kegagalan nyata: customer tanya "ada project di sekitaran
  // BSD?" dan bot menjawab tidak tahu, PADAHAL "bsd" sudah terdaftar sebagai
  // kata kunci. Penyebabnya: search_knowledge_base milik Telebot ternyata
  // bukan pencocokan substring seperti Ivy, melainkan pencarian berbasis
  // kemiripan makna -- dan yang paling menentukan adalah teks di kolom
  // Question, bukan kolom Keywords. Bukti pendukungnya: kata "Boleh" yang
  // tidak punya kecocokan kata kunci sama sekali malah menarik jawaban
  // "Bisa survey lokasi dulu?" karena maknanya mirip.
  //
  // Karena itu nama daerah harus muncul di PERTANYAAN-nya, bukan cuma di
  // kata kunci. Tanpa entri ini, tidak ada satu pun pertanyaan kita yang
  // menyebut BSD / Bekasi / Bandung / Summarecon.
  const byDaerah = new Map<string, ProjectRow[]>();
  for (const p of projects) {
    const key = p.daerah.trim();
    if (!key) continue;
    if (!byDaerah.has(key)) byDaerah.set(key, []);
    byDaerah.get(key)!.push(p);
  }

  for (const [daerah, units] of byDaerah) {
    if (!belumAda(`Ada project di ${daerah}?`)) continue;
    const clusters = [...new Set(units.map((u) => u.nama_cluster.trim()).filter(Boolean))];
    const bubbles: TelebotBubble[] = [];

    bubbles.push({
      type: "text",
      content:
        clusters.length > 1
          ? `Ada kak! Di area ${daerah} kita punya ${clusters.length} cluster: ${clusters.join(", ")}. Aku kirimkan detailnya ya 🏠`
          : `Ada kak! Di area ${daerah} kita punya ${clusters[0]}. Aku kirimkan detailnya ya 🏠`,
      media_url: null,
      sort_order: 0,
    });

    const adaFotoDaerah = units.some((u) => parseUrls(u.foto_url).length > 0);
    if (adaFotoDaerah) bubbles.push(...fotoBubbles(units, bubbles.length));
    else for (const unit of units) {
      bubbles.push({
        type: "text",
        content: specToCaption(unit),
        media_url: null,
        sort_order: bubbles.length,
      });
    }

    // Sengaja TIDAK memakai nama daerah polos ("bekasi") -- kata itu sudah
    // dipakai QnA harga cluster terkait, nanti jadi rebutan. Yang dipakai
    // bentuk berfrasa, jadi tidak ada yang persis sama.
    const d = daerah.toLowerCase();
    const keywords = [
      `di ${d}`,
      `area ${d}`,
      `sekitar ${d}`,
      `sekitaran ${d}`,
      `project di ${d}`,
      `properti di ${d}`,
      `rumah di ${d}`,
      `perumahan ${d}`,
    ].join(", ");

    entries.push({
      category: "AREA",
      question: `Ada project di ${daerah}?`,
      keywords,
      bubbles,
    });
  }

  // --- 4. Satu entri PROMO per cluster ---
  //
  // Lahir dari kegagalan nyata juga: customer tanya "cluster yang di cibubur
  // tadi, ada promoan nggak?" dan Delia mengulang jawaban promo generik yang
  // sama persis dengan pesan sebelumnya. Penyebabnya, entri promo cuma ada
  // SATU dan sifatnya umum ("Sekarang ada promo apa?") yang ujungnya malah
  // balik bertanya "kakak tertarik cluster yang mana?" -- padahal begitu
  // customer menjawab, tidak ada entri yang bisa melayani. Jadi berputar.
  //
  // Datanya sendiri sudah ada sejak awal, tersimpan di kolom spec tiap unit,
  // cuma tidak pernah dimunculkan sebagai entri sendiri.
  for (const [cluster, units] of byCluster) {
    if (!belumAda(`Promo apa di ${cluster}?`)) continue;
    const perUnit = units
      .map((u) => {
        const promo = parseSpecLines(u.spec).filter((l) =>
          /promo|free|bonus|cashback|diskon|dp mulai/i.test(l)
        );
        return promo.length ? { unit: u, promo } : null;
      })
      .filter((x): x is { unit: ProjectRow; promo: string[] } => x !== null);

    if (perUnit.length === 0) continue;

    const baris: string[] = [`Promo di ${cluster} 🎉`];
    for (const { unit, promo } of perUnit) {
      const tipe = extractTipeName(unit.spec);
      baris.push("");
      baris.push(tipe ? `📍 Tipe ${tipe}` : `📍 ${unit.nama_cluster}`);
      for (const p of promo) baris.push(`• ${p}`);
    }

    const short = stripClusterWord(cluster).toLowerCase();
    const keywords = [
      `promo ${short}`,
      `promonya ${short}`,
      `diskon ${short}`,
      `cashback ${short}`,
      `bonus ${short}`,
      `penawaran ${short}`,
    ].join(", ");

    entries.push({
      category: "PROMO",
      question: `Promo apa di ${cluster}?`,
      keywords,
      bubbles: [
        {
          type: "text",
          content: baris.join("\n"),
          media_url: null,
          sort_order: 0,
        },
      ],
    });
  }

  return entries;
}
