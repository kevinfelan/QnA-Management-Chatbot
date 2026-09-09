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
// Caption spec ditata mengikuti format yang dipakai agent di WhatsApp:
// nama cluster di dalam bintang, daftar tipe dengan bintang dan pemisah
// "|", lalu harga sebagai butir. Versi sebelumnya cuma memotong kalimat
// spec apa adanya, hasilnya padat dan tidak enak dibaca.
function specToCaption(project: ProjectRow): string {
  const spec = project.spec || "";
  const baris: string[] = [`✨ ${project.nama_cluster.toUpperCase()} ✨`];
  if (project.daerah) baris.push(project.daerah);

  // "Tipe 1 lantai: LB 34 m2, LT 75 m2, 2 KT, 1 KM, carport"
  //   -> "⭐ Tipe 1 Lantai" + "LB 34 | LT 75 | 2 KT | 1 KM | Carport"
  const tipeLantai = [...spec.matchAll(/Tipe (\d) lantai:\s*([^.]+)/gi)];
  if (tipeLantai.length) {
    baris.push("", "🏠 Pilihan Tipe Rumah:");
    for (const [, lantai, isi] of tipeLantai) {
      const bagian = isi
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^(LB|LT|\d+\s*(KT|KM)|carport)/i.test(s))
        .map((s) =>
          s.replace(/\s*m2\b/i, "").replace(/^carport$/i, "Carport")
        );
      baris.push(`⭐ Tipe ${lantai} Lantai`);
      if (bagian.length) baris.push(bagian.join(" | "));
    }
  } else {
    // cluster yang spec-nya cuma "Tipe: T36/60, T36/66, ..."
    const daftar = spec.match(/Tipe:\s*([^.]+)/i)?.[1];
    if (daftar) baris.push("", `🏠 Tipe tersedia:`, daftar.trim());
  }

  // harga ditaruh paling bawah, seperti punya agent
  const harga = spec.match(/Harga mulai\s*([^.]+)/i)?.[1];
  const hargaLantai2 = spec.match(/Tipe 2 lantai:[^.]*?mulai ([\d.,]+\s*M[- ]?an)/i)?.[1];
  if (harga) {
    baris.push("", "💰 Harga:");
    const mulai = harga.replace(/\s*sampai.*$/i, "").trim();
    baris.push(hargaLantai2 ? `• Mulai ${mulai} (1 lantai)` : `• Mulai ${mulai}`);
    if (hargaLantai2) baris.push(`• Mulai ${hargaLantai2} (2 lantai)`);
  }

  // Promo ikut masuk ke CAPTION, bukan jadi gelembung teks tersendiri.
  //
  // Sebabnya urutan kirim: gelembung teks sampai di HP customer lebih cepat
  // daripada gambar, jadi teks promo yang secara urutan ada di belakang foto
  // malah muncul menyelip di tengah-tengah foto. Kalau ditempel jadi satu
  // caption dengan spec, urutannya dijamin -- keduanya satu pesan.
  const promo = spec.match(/Promo:\s*([^.]+)/i)?.[1];
  if (promo) {
    baris.push("", "🎁 Yang bikin worth it:");
    for (const x of promo.split(";").map((s) => s.trim()).filter(Boolean)) {
      baris.push(`✨ ${x}`);
    }
  }

  return baris.join("\n");
}

// Penanda [BUBBLE] memecah satu jawaban jadi beberapa gelembung teks
// terpisah. Agent memang mengirim begitu: sapaan dulu satu pesan, lalu
// "wait ya kak, aku share info projectnya", baru isinya. Kalau semuanya
// digabung jadi satu pesan panjang, langsung terasa seperti balasan mesin.
function teksBubbles(teks: string, mulaiDari: number): TelebotBubble[] {
  return teks
    .split(/\n*\[BUBBLE\]\n*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((content, i) => ({
      type: "text" as const,
      content,
      media_url: null,
      sort_order: mulaiDari + i,
    }));
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
//
// `hanyaFasad` mengambil foto PERTAMA tiap unit saja. Urutan foto_url di
// sheet Projects selalu diawali fasad, jadi opsi ini = "kirim tampak
// depannya saja". Dipakai di dua tempat:
//   - entri pembuka, waktu customer belum minta apa-apa selain info project
//   - entri daftar per daerah, supaya tiap cluster kebagian satu foto
//     ketimbang satu cluster menghabiskan jatah dengan foto kamar mandinya
// Kalau customer memang MINTA foto ("boleh minta fotonya?"), entri Foto
// Properti tetap mengirim interior lengkap -- di situ dia sudah minta.
function fotoBubbles(
  units: ProjectRow[],
  mulaiDari: number,
  opsi: { maks?: number; hanyaFasad?: boolean } = {}
): TelebotBubble[] {
  const maks = opsi.maks ?? MAKS_FOTO;
  const out: TelebotBubble[] = [];
  const unitDari: ProjectRow[] = [];
  for (const unit of units) {
    const urls = parseUrls(unit.foto_url);
    for (const url of opsi.hanyaFasad ? urls.slice(0, 1) : urls) {
      if (out.length >= maks) break;
      out.push({
        type: "image",
        content: "",
        media_url: url,
        sort_order: mulaiDari + out.length,
      });
      unitDari.push(unit);
    }
    if (out.length >= maks) break;
  }
  if (!out.length) return out;

  if (opsi.hanyaFasad) {
    // Tiap foto di sini milik unit yang berbeda, jadi masing-masing bawa
    // caption spec-nya sendiri -- bukan cuma yang terakhir.
    out.forEach((b, i) => (b.content = specToCaption(unitDari[i])));
  } else {
    // Caption spec ditempel di foto TERAKHIR, bukan yang pertama. Di WhatsApp
    // caption muncul di bawah gambar; kalau ditaruh di foto pertama, spec-nya
    // langsung ketutup tiga foto berikutnya dan customer harus scroll balik.
    out[out.length - 1].content = specToCaption(unitDari[unitDari.length - 1]);
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

    const bubbles: TelebotBubble[] = teksBubbles(renameAgent(jawaban), 0);

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

    // Di pembukaan customer belum minta apa-apa: cukup tampak depan + spec
    // dan daya tariknya. Foto kamar, dapur, kamar mandi baru dikirim kalau
    // dia memang meminta foto -- itu entri Foto Properti, bukan yang ini.
    const opsiFoto: { maks?: number; hanyaFasad?: boolean } =
      /pembuka/i.test(row.kategori) ? { maks: 1, hanyaFasad: true } : {};

    if (units) {
      bubbles.push(...fotoBubbles(units, bubbles.length, opsiFoto));
      // video hanya di entri FOTO, bukan di entri Pembuka -- pembuka sengaja
      // dijaga ringan, menambah video di situ kelewat berat
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
      const [sebelum, sesudahMentah] = renameAgent(jawaban).split(/\n*\[FOTO\]\n*/);

      // Penanda [CAPTION]: teks sesudahnya TIDAK jadi gelembung sendiri,
      // melainkan disambung ke caption foto terakhir.
      //
      // Ini bukan soal rapi-rapian. Gelembung teks sampai di HP customer
      // lebih cepat daripada gambar, jadi teks apa pun yang ditaruh setelah
      // foto akan menyalip dan muncul menyelip di tengah-tengah foto.
      // Satu-satunya cara memastikan sesuatu terbaca SETELAH foto adalah
      // menempelkannya ke foto terakhir -- karena satu pesan tidak bisa
      // menyalip dirinya sendiri.
      const [sesudah, keCaption] = (sesudahMentah || "").split(/\n*\[CAPTION\]\n*/);
      const foto = fotoBubbles(units, 1, opsiFoto);
      if (keCaption && keCaption.trim() && foto.length) {
        const t = foto[foto.length - 1];
        t.content = t.content ? `${t.content}\n\n${keCaption.trim()}` : keCaption.trim();
      }

      bubbles.length = 0;
      for (const b of teksBubbles(sebelum, bubbles.length)) bubbles.push(b);
      for (const b of foto) bubbles.push({ ...b, sort_order: bubbles.length });
      for (const b of teksBubbles(sesudah || "", bubbles.length)) bubbles.push(b);
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
    // Daftar per daerah: satu tampak depan per cluster. Tanpa ini satu
    // cluster menghabiskan jatah 4 foto dengan interiornya sendiri, dan
    // cluster lain di daerah yang sama tidak kebagian foto sama sekali.
    if (adaFotoDaerah)
      bubbles.push(...fotoBubbles(units, bubbles.length, { hanyaFasad: true }));
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
        // bagian "Promo: a; b; c" ditulis khusus di kolom spec -- dipecah
        // per titik koma supaya jadi butir sendiri, bukan satu baris panjang
        // yang masih membawa awalan "Promo:"
        const blok = u.spec.match(/Promo:\s*([^.]+)/i)?.[1];
        const promo = blok
          ? blok.split(";").map((s) => s.trim()).filter(Boolean)
          : parseSpecLines(u.spec).filter((l) =>
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
