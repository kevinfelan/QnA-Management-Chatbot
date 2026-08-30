"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectRow, QnaRow } from "@/lib/sheets";
import { IconSend, IconUser } from "./icons";

type ChatMessage = {
  id: string;
  sender: "user" | "bot";
  text: string;
  meta?: string;
  images?: string[];
};

type BotPart = {
  text: string;
  images?: string[];
  meta?: string;
};

type MatchResult = {
  row: QnaRow;
  matchedKeywords: string[];
};

const FALLBACK_TEXT = "Maaf kak sepertinya Ivy belum bisa jawab pertanyaan itu";

const ANGER_KEYWORDS = [
  "kesal",
  "kecewa",
  "marah",
  "buruk",
  "jelek",
  "parah",
  "sebel",
  "gak niat",
  "nggak niat",
  "lama banget",
  "lambat banget",
  "males banget",
  "capek nunggu",
  "gak profesional",
];

const PHOTO_KEYWORDS = ["foto", "fotonya", "gambar", "gambarnya", "poto", "picture", "penampakan"];
const VIDEO_KEYWORDS = ["video", "videonya", "vidio", "rekaman"];
const LOCATION_KEYWORDS = ["lokasi", "dimana", "di mana", "alamat", "deket mana", "sebelah mana", "sekitar mana"];

// keunggulan lokasi per cluster -- dipakai saat customer nanya lokasi 1
// project spesifik, biar jawabannya nggak cuma alamat doang.
const LOCATION_HIGHLIGHTS: Record<string, string> = {
  "Cluster Nusa Indah": "5 menit ke Tol BSD-Serpong, deket AEON Mall BSD & kawasan bisnis Sinarmas Land",
  "Cluster Anggrek Cibubur": "5 menit ke Tol Cimanggis, deket Plaza Cibubur & beberapa sekolah favorit",
  "Cluster Melati Regency": "10 menit ke Tol Bekasi Barat, deket Summarecon Mall Bekasi & stasiun KRL",
  "Cluster Garden View": "langsung di kawasan Summarecon, deket Mall Summarecon, akses tol cuma 5 menit",
  "Cluster Dago Asri": "view pegunungan asri, 10 menit ke Tol Padaleunyi & dekat kawasan wisata Dago",
};

function locationHighlightFor(namaCluster: string): string {
  return LOCATION_HIGHLIGHTS[namaCluster] || "akses mudah ke jalan utama & fasilitas sekitar lengkap";
}

function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function findBestMatch(segment: string, rows: QnaRow[]): MatchResult | null {
  const lowerSeg = segment.toLowerCase();
  let best: (MatchResult & { score: number }) | null = null;

  for (const row of rows) {
    if (!row.aktif) continue;

    const keywords = row.kata_kunci
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const matched = keywords.filter((k) => lowerSeg.includes(k));

    if (matched.length > 0 && (!best || matched.length > best.score)) {
      best = { row, matchedKeywords: matched, score: matched.length };
    }
  }

  return best ? { row: best.row, matchedKeywords: best.matchedKeywords } : null;
}

// nama cluster biasanya diawali "Cluster ..." tapi customer sering nyebut
// tanpa kata "cluster"-nya (mis. "ada properti di Dago Asri?"), jadi
// dibandingkan tanpa prefix itu.
function stripClusterWord(name: string): string {
  return name.replace(/^cluster\s+/i, "").trim();
}

// cek apakah segmen pesan nyebut nama cluster atau nama daerah tertentu
// secara eksplisit -- dipakai buat trigger listing "foto+spec per unit".
function findProjectsByAreaMention(
  segment: string,
  projects: ProjectRow[]
): { matches: ProjectRow[]; label: string } | null {
  const lower = segment.toLowerCase();

  const clusterNames = Array.from(
    new Set(projects.map((p) => p.nama_cluster.trim()).filter(Boolean))
  );
  const matchedCluster = clusterNames.find((c) => {
    const key = stripClusterWord(c).toLowerCase();
    return key.length >= 3 && lower.includes(key);
  });
  if (matchedCluster) {
    return {
      matches: projects.filter(
        (p) => p.nama_cluster.trim().toLowerCase() === matchedCluster.toLowerCase()
      ),
      label: matchedCluster,
    };
  }

  const daerahNames = Array.from(new Set(projects.map((p) => p.daerah.trim()).filter(Boolean)));
  const matchedDaerah = daerahNames.find((d) => lower.includes(d.toLowerCase()));
  if (matchedDaerah) {
    return {
      matches: projects.filter(
        (p) => p.daerah.trim().toLowerCase() === matchedDaerah.toLowerCase()
      ),
      label: matchedDaerah,
    };
  }

  return null;
}

// ambil nama tipe dari awal teks spec, mis. "Tipe Anindya. LT90/LB70..." -> "Anindya"
function extractTipeName(spec: string): string | null {
  const match = spec.match(/^Tipe\s+([^.]+)\./i);
  return match ? match[1].trim() : null;
}

// cari project lewat nama tipe SAJA (bukan cluster/daerah) -- ini sinyal
// paling spesifik & kuat kalau customer nyebut nama tipe, jadi harus selalu
// menang atas konteks obrolan sebelumnya, apapun bentuk pertanyaannya.
function findProjectByTipeName(segment: string, projects: ProjectRow[]): ProjectRow | null {
  const lower = segment.toLowerCase();
  for (const p of projects) {
    const tipeName = extractTipeName(p.spec);
    if (tipeName && tipeName.length >= 3 && lower.includes(tipeName.toLowerCase())) {
      return p;
    }
  }
  return null;
}

// cari 1 project spesifik yang disebut lewat nama tipe, nama cluster, atau
// daerah -- dipakai buat jawab pertanyaan lokasi project tertentu tanpa
// nge-list semua project (beda dari findProjectsByAreaMention).
function findProjectMention(
  segment: string,
  projects: ProjectRow[]
): { project: ProjectRow; tipeName: string | null } | null {
  const lower = segment.toLowerCase();

  const tipeMatch = findProjectByTipeName(segment, projects);
  if (tipeMatch) {
    return { project: tipeMatch, tipeName: extractTipeName(tipeMatch.spec) };
  }

  const clusterNames = Array.from(
    new Set(projects.map((p) => p.nama_cluster.trim()).filter(Boolean))
  );
  const matchedCluster = clusterNames.find((c) => {
    const key = stripClusterWord(c).toLowerCase();
    return key.length >= 3 && lower.includes(key);
  });
  if (matchedCluster) {
    const project = projects.find(
      (p) => p.nama_cluster.trim().toLowerCase() === matchedCluster.toLowerCase()
    );
    if (project) return { project, tipeName: null };
  }

  const daerahNames = Array.from(new Set(projects.map((p) => p.daerah.trim()).filter(Boolean)));
  const matchedDaerah = daerahNames.find((d) => lower.includes(d.toLowerCase()));
  if (matchedDaerah) {
    const project = projects.find(
      (p) => p.daerah.trim().toLowerCase() === matchedDaerah.toLowerCase()
    );
    if (project) return { project, tipeName: null };
  }

  return null;
}

// jawab pertanyaan lokasi utk 1 project spesifik (bukan rekomendasi seluruh
// project), lalu tanya balik area mobilisasi customer biar rekomendasi
// selanjutnya lebih pas.
function buildLocationAnswer(project: ProjectRow, tipeName: string | null): SegmentResult {
  const label = tipeName ? `Tipe ${tipeName}` : project.nama_cluster;
  const highlight = locationHighlightFor(project.nama_cluster);

  return {
    parts: [
      { text: `Kalau ${label} lokasinya di ${project.daerah} kak, ${highlight}.` },
      {
        text: "Kakak mobilisasi sehari-hari di daerah mana kak? Biar Ivy bisa rekomendasiin properti yang paling pas buat kakak 😊",
      },
    ],
    cluster: project.nama_cluster,
    // cuma diinget sbg "properti spesifik yang dibahas" kalau customer nyebut
    // nama tipenya -- kalau cuma nyebut cluster, tetep ambigu unit yang mana.
    project: tipeName ? project : undefined,
  };
}

// area mobilisasi customer (bukan nama cluster resmi) -> cluster yang
// aksesnya paling deket ke situ, dipakai buat jawab "aku mobilisasi di X".
// Catatan: BSD/Cibubur/Bekasi/Summarecon/Bandung nggak perlu masuk di sini
// karena udah ke-cover exact match nama daerah cluster (findProjectsByAreaMention).
type ProximityRule = { keywords: string[]; cluster: string; reason: string };

const AREA_PROXIMITY: ProximityRule[] = [
  {
    keywords: ["serpong", "alam sutera", "bintaro", "tangerang", "gading serpong", "bumi serpong damai"],
    cluster: "Cluster Nusa Indah",
    reason: "satu kawasan deket BSD, aksesnya gampang",
  },
  {
    keywords: [
      "cileungsi",
      "jagorawi",
      "depok",
      "jakarta selatan",
      "kuningan",
      "tebet",
      "pasar rebo",
      "cawang",
      "scbd",
      "sudirman",
      "senayan",
      "gatot subroto",
      "gatsu",
      "thamrin",
    ],
    cluster: "Cluster Anggrek Cibubur",
    reason: "aksesnya gampang lewat Tol Cimanggis/Jagorawi ke arah situ",
  },
  {
    keywords: ["cikarang", "jakarta timur", "cakung", "kalimalang"],
    cluster: "Cluster Melati Regency",
    reason: "deket sama arah situ lewat akses Bekasi",
  },
  {
    keywords: ["cimahi", "dago", "lembang", "padalarang"],
    cluster: "Cluster Dago Asri",
    reason: "satu arah sama kawasan situ di Bandung",
  },
];

function findClusterByProximity(
  segment: string
): { cluster: string; matchedArea: string; reason: string } | null {
  const lower = segment.toLowerCase();
  for (const rule of AREA_PROXIMITY) {
    const matchedKeyword = rule.keywords.find((k) => lower.includes(k));
    if (matchedKeyword) {
      return { cluster: rule.cluster, matchedArea: matchedKeyword, reason: rule.reason };
    }
  }
  return null;
}

// pisah pesan jadi beberapa "pertanyaan" berdasarkan tanda tanya/baris baru,
// supaya pesan yang berisi >1 pertanyaan dijawab satu-satu.
function splitQuestions(message: string): string[] {
  const parts = message
    .split(/(?<=\?)|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [message];
}

function detectAnger(message: string): boolean {
  const lower = message.toLowerCase();
  return ANGER_KEYWORDS.some((k) => lower.includes(k));
}

// ganti "saya"->"aku" dan "anda"->"kakak" (jaga kapitalisasi awal kata),
// gaya bicara Ivy sesuai persona sales.
function applyIvyVoice(text: string): string {
  return text
    .replace(/\bsaya\b/g, "aku")
    .replace(/\bSaya\b/g, "Aku")
    .replace(/\banda\b/g, "kakak")
    .replace(/\bAnda\b/g, "Kakak");
}

function metaFor(match: MatchResult): string {
  const parts = [`Cocok kata kunci: "${match.matchedKeywords.join(", ")}"`];
  if (match.row.nama_cluster) parts.push(match.row.nama_cluster);
  if (match.row.kategori) parts.push(match.row.kategori);
  return parts.join(" • ");
}

type SegmentResult = {
  parts: BotPart[];
  cluster?: string;
  // diisi cuma kalau segmen ini nunjuk ke 1 unit spesifik (mis. nyebut nama
  // tipe), dipakai buat inget "properti yang lagi dibahas" antar pesan --
  // beda dari `cluster` yang bisa merujuk ke banyak unit sekaligus.
  project?: ProjectRow;
  // diisi id project yang baru aja di-share foto+spec-nya di segmen ini --
  // dipakai buat nandain unit itu "udah pernah di-share" biar nggak diulang.
  // Per-project (bukan per-cluster) supaya akurat waktu Ivy cuma share 1
  // unit spesifik dari cluster yang isinya lebih dari 1 unit.
  sharedProjectIds?: string[];
  // diisi true kalau segmen ini udah nawarin survey (eksplisit "tertarik"
  // atau nudge dari listing yang diulang) -- dipakai biar nudge implisit
  // (>=3x nanya properti sama) nggak nawarin survey dobel.
  surveyOffered?: boolean;
};

// pecah teks spec ("LT90/LB70, 2 lantai, 3KT 2KM. Harga mulai 1.2 M.") jadi
// per baris berdasarkan koma atau titik-akhir-kalimat (bukan titik desimal
// harga), supaya enak dibaca di chat bubble.
function parseSpecLines(spec: string): string[] {
  return spec
    .split(/,\s*|\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// kelompokkan baris spec jadi header (nama tipe), spesifikasi bangunan,
// harga+cicilan, dan promo -- berdasarkan baris yang diawali "Harga"/"Promo".
function groupSpecLines(lines: string[]): {
  header: string[];
  specs: string[];
  harga: string[];
  promo: string[];
} {
  const header: string[] = [];
  const specs: string[] = [];
  const harga: string[] = [];
  const promo: string[] = [];
  let stage: "header" | "specs" | "harga" | "promo" = "header";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (stage === "header" && !lower.startsWith("tipe")) stage = "specs";
    if (lower.startsWith("harga")) stage = "harga";
    if (lower.startsWith("promo")) stage = "promo";

    if (stage === "header") header.push(line);
    else if (stage === "specs") specs.push(line);
    else if (stage === "harga") harga.push(line);
    else promo.push(line);
  }

  return { header, specs, harga, promo };
}

// susun 1 blok pesan per unit: label cluster+tipe di atas, lalu spesifikasi,
// harga/cicilan, dan promo masing-masing jadi paragraf terpisah (dikasih
// jeda baris kosong) supaya nggak berdempetan kayak referensi.
function formatPropertyBlock(clusterDaerahLine: string, specLines: string[]): string {
  const { header, specs, harga, promo } = groupSpecLines(specLines);
  const bullet = (items: string[]) => items.map((l) => `• ${l}`).join("\n");

  const sections = [
    [clusterDaerahLine, ...header].filter(Boolean).join("\n"),
    bullet(specs),
    bullet(harga),
    bullet(promo),
  ].filter(Boolean);

  return sections.join("\n\n");
}

// intro "ada N project nih kak..." lalu 1 pesan terpisah per unit (foto+spec).
function buildAreaListing(
  matches: ProjectRow[],
  areaLabel: string,
  kind: "foto" | "video",
  introText?: string
): SegmentResult {
  const withMedia = matches.filter(
    (p) => parseUrls(kind === "foto" ? p.foto_url : p.video_url).length > 0
  );
  const list = withMedia.length > 0 ? withMedia : matches;

  const parts: BotPart[] = [
    {
      text: introText ?? `Ada ${list.length} project nih kak di ${areaLabel}, wait ya Ivy kirim info projectnya.`,
    },
  ];

  for (const p of list) {
    const urls = parseUrls(kind === "foto" ? p.foto_url : p.video_url);
    const specLine = [p.nama_cluster, p.daerah].filter(Boolean).join(" — ");
    const specLines = p.spec ? parseSpecLines(p.spec) : ["(spec belum diisi)"];
    parts.push({
      text: formatPropertyBlock(specLine, specLines),
      images: kind === "foto" && urls.length > 0 ? urls : undefined,
      meta: kind === "video" && urls.length > 0 ? urls.join(", ") : undefined,
    });
  }

  parts.push({ text: "Kakak lebih tertarik yang mana? 😊" });

  return { parts, cluster: matches[0]?.nama_cluster };
}

// cluster ini udah pernah di-share foto+spec-nya di obrolan ini -> jangan
// diulang, cukup dorong percakapan ke arah tujuan akhir: jadwal survey.
function buildSurveyNudge(
  clusterName: string,
  matches: ProjectRow[],
  activeProject: ProjectRow | null
): SegmentResult {
  const sameCluster =
    activeProject && activeProject.nama_cluster.trim().toLowerCase() === clusterName.trim().toLowerCase();
  const relevantProject = sameCluster ? activeProject : matches[0] ?? null;
  const tipeName = relevantProject ? extractTipeName(relevantProject.spec) : null;
  const label = tipeName ? `Tipe ${tipeName}` : clusterName;

  return {
    parts: [
      {
        text: `Foto & spec-nya udah Ivy share tadi ya kak 😊 Kalau kakak tertarik ${label}, mau Ivy jadwalkan survey ke lokasi?`,
      },
    ],
    cluster: clusterName,
    project: sameCluster ? activeProject ?? undefined : undefined,
    surveyOffered: true,
  };
}

// share listing foto+spec 1/beberapa unit -- tapi kalau SEMUA unit di
// `matches` udah pernah di-share sebelumnya di obrolan ini, jangan diulang,
// ganti jadi ajakan survey. Per-unit (bukan per-cluster) supaya akurat
// waktu yang di-share cuma sebagian unit dari sebuah cluster.
function shareListingOrNudge(
  matches: ProjectRow[],
  areaLabel: string,
  kind: "foto" | "video",
  sharedProjectIds: Set<string>,
  activeProject: ProjectRow | null
): SegmentResult {
  const allShared = matches.length > 0 && matches.every((p) => sharedProjectIds.has(p.id));
  if (allShared) {
    const clusterName = matches[0]?.nama_cluster ?? areaLabel;
    return buildSurveyNudge(clusterName, matches, activeProject);
  }

  const listing = buildAreaListing(matches, areaLabel, kind);
  return { ...listing, sharedProjectIds: matches.map((p) => p.id) };
}

// customer nanya "ada rumah lain nggak?" saat konteks lagi fokus ke 1 unit
// -> share unit LAIN di cluster yang sama (bukan ngulang unit yang lagi
// dibahas), dengan intro "ada lagi nih kak di [cluster]".
function buildOtherOptionsListing(others: ProjectRow[], clusterName: string): SegmentResult {
  const listing = buildAreaListing(others, clusterName, "foto", `Ada lagi nih kak di ${clusterName}:`);
  return { ...listing, sharedProjectIds: others.map((p) => p.id) };
}

// jawab "aku mobilisasi di X" dengan rekomendasi cluster terdekat + alasan,
// lalu lanjut share foto+spec unit-nya (reuse buildAreaListing, cuma baris
// pembukanya diganti jadi kalimat rekomendasi).
function buildMobilityRecommendation(
  proximity: { cluster: string; matchedArea: string; reason: string },
  projectRows: ProjectRow[],
  activeCluster: string | null,
  activeProject: ProjectRow | null,
  sharedProjectIds: Set<string>
): SegmentResult {
  // customer udah nyebut area/cluster incaran sebelumnya di obrolan --
  // jangan langsung dialihin ke cluster lain cuma gara-gara jawab mobilisasi.
  // Validasi pilihan awal dia + jelasin aksesnya ke arah mobilisasi itu.
  if (activeCluster) {
    const targetMatches = projectRows.filter(
      (p) => p.nama_cluster.trim().toLowerCase() === activeCluster.toLowerCase()
    );
    if (targetMatches.length > 0) {
      const targetDaerah = targetMatches[0].daerah;
      const highlight = locationHighlightFor(activeCluster);
      const sameCluster = activeCluster.toLowerCase() === proximity.cluster.toLowerCase();

      const intro: BotPart = sameCluster
        ? {
            text: `Pas banget kak! ${activeCluster} emang paling cocok buat mobilisasi ke arah situ juga — ${highlight}.`,
          }
        : {
            text: `Kalau kakak mobilisasi ke arah situ tapi mau ambil di ${targetDaerah} kak, tetap paling cocok di ${activeCluster} — ${highlight}, jadi masih gampang buat commute harian.`,
          };

      if (targetMatches.every((p) => sharedProjectIds.has(p.id))) {
        const nudge = buildSurveyNudge(activeCluster, targetMatches, activeProject);
        return { parts: [intro, ...nudge.parts], cluster: targetMatches[0]?.nama_cluster, project: nudge.project };
      }

      intro.text += "\n\nIvy kirimin detail unitnya ya!";
      const listing = buildAreaListing(targetMatches, activeCluster, "foto");
      return {
        parts: [intro, ...listing.parts.slice(1)],
        cluster: targetMatches[0]?.nama_cluster,
        sharedProjectIds: targetMatches.map((p) => p.id),
      };
    }
  }

  const matches = projectRows.filter(
    (p) => p.nama_cluster.trim().toLowerCase() === proximity.cluster.toLowerCase()
  );
  if (matches.length === 0) {
    return { parts: [{ text: FALLBACK_TEXT }] };
  }

  if (matches.every((p) => sharedProjectIds.has(p.id))) {
    const introText: BotPart = {
      text: `Kalau mobilisasi kakak ke arah situ, yang paling recommended ${proximity.cluster} kak — ${proximity.reason}.`,
    };
    const nudge = buildSurveyNudge(proximity.cluster, matches, activeProject);
    return { parts: [introText, ...nudge.parts], cluster: matches[0]?.nama_cluster, project: nudge.project };
  }

  const listing = buildAreaListing(matches, proximity.cluster, "foto");
  const intro: BotPart = {
    text: `Kalau mobilisasi kakak ke arah situ, yang paling recommended ${proximity.cluster} kak — ${proximity.reason}.\n\nIvy kirimin detail unitnya ya!`,
  };

  return {
    parts: [intro, ...listing.parts.slice(1)],
    cluster: matches[0]?.nama_cluster,
    sharedProjectIds: matches.map((p) => p.id),
  };
}

const KPR_FEASIBILITY_KEYWORDS = [
  "bisa kpr",
  "kpr bisa",
  "bisa di kpr",
  "bisa dikpr",
  "bisa dicicil",
  "bisa kredit",
];

// "bisa KPR?" itu ambigu tanpa konteks -- Ivy harus liat obrolan sebelumnya
// (activeProject/activeCluster) buat tau properti mana yang dimaksud,
// baru kasih hitungan harga & cicilan yang sesuai. Kalau belum ada konteks
// sama sekali, tanya balik properti yang dimaksud.
function buildKprFeasibilityAnswer(
  activeProject: ProjectRow | null,
  activeCluster: string | null,
  projectRows: ProjectRow[]
): SegmentResult {
  if (activeProject) {
    const tipeName = extractTipeName(activeProject.spec);
    const label = tipeName ? `Tipe ${tipeName}` : activeProject.nama_cluster;
    const { harga } = groupSpecLines(activeProject.spec ? parseSpecLines(activeProject.spec) : []);

    return {
      parts: [
        {
          text: `Bisa banget kak! 👍 Untuk ${label} di ${activeProject.nama_cluster} (${activeProject.daerah}):\n\n${harga
            .map((l) => `• ${l}`)
            .join("\n")}\n\nAsumsi DP 10%, tenor 20-25 tahun ya kak. Mau Ivy bantu hitungin simulasi lebih detail sesuai penghasilan kakak? 😊`,
        },
      ],
      cluster: activeProject.nama_cluster,
      project: activeProject,
    };
  }

  if (activeCluster) {
    const matches = projectRows.filter(
      (p) => p.nama_cluster.trim().toLowerCase() === activeCluster.toLowerCase()
    );
    if (matches.length > 0) {
      const lines = matches.map((p) => {
        const tipeName = extractTipeName(p.spec);
        const { harga } = groupSpecLines(p.spec ? parseSpecLines(p.spec) : []);
        return `• ${tipeName ? `Tipe ${tipeName}` : p.nama_cluster} — ${harga.join(", ")}`;
      });

      return {
        parts: [
          {
            text: `Bisa banget kak! 👍 Untuk ${activeCluster}:\n\n${lines.join(
              "\n"
            )}\n\nAsumsi DP 10%, tenor 20-25 tahun. Kakak minat tipe yang mana? Biar Ivy hitungin lebih detail 😊`,
          },
        ],
        cluster: activeCluster,
      };
    }
  }

  return {
    parts: [
      {
        text: "Bisa kok kak! 👍 Tapi biar Ivy kasih simulasi yang pas, kakak lagi minat properti/cluster yang mana ya? 😊",
      },
    ],
  };
}

const BONUS_KEYWORDS = ["bonus", "hadiah", "gift", "dapat apa"];

// "ada bonus apa aja?" tanpa nyebut nama cluster/tipe -> jawab bonus punya
// properti yang lagi jadi konteks obrolan aja, jangan kasih daftar bonus
// semua cluster kalau customer jelas-jelas lagi ngomongin 1 unit spesifik.
function buildBonusAnswer(project: ProjectRow): SegmentResult | null {
  const tipeName = extractTipeName(project.spec);
  const label = tipeName ? `Tipe ${tipeName} di ${project.nama_cluster}` : project.nama_cluster;
  const { promo } = groupSpecLines(project.spec ? parseSpecLines(project.spec) : []);

  if (promo.length === 0) return null;

  return {
    parts: [
      {
        text: `Untuk ${label} kak, bonus & promonya:\n\n${promo
          .map((l) => `• ${l}`)
          .join("\n")}\n\nMau Ivy jelasin lebih detail kak? 😊`,
      },
    ],
    cluster: project.nama_cluster,
    project,
  };
}

const PRICE_KEYWORDS = ["harga", "cicilan"];

// "harga/cicilan berapa?" tanpa nyebut nama cluster/tipe -> jawab harga
// punya properti yang lagi jadi konteks obrolan aja, jangan asal kena
// jawaban cluster lain gara-gara tie-break keyword.
function buildPriceAnswer(project: ProjectRow): SegmentResult | null {
  const tipeName = extractTipeName(project.spec);
  const label = tipeName ? `Tipe ${tipeName} di ${project.nama_cluster}` : project.nama_cluster;
  const { harga } = groupSpecLines(project.spec ? parseSpecLines(project.spec) : []);

  if (harga.length === 0) return null;

  return {
    parts: [
      {
        text: `Untuk ${label} kak:\n\n${harga
          .map((l) => `• ${l}`)
          .join("\n")}\n\nMau Ivy bantu hitungin simulasi KPR-nya juga? 😊`,
      },
    ],
    cluster: project.nama_cluster,
    project,
  };
}

// customer udah nanya properti spesifik ini berkali-kali (KPR, lokasi,
// bonus, dst) tanpa pernah bilang "tertarik" -- itu sinyal minat implisit,
// disambung ke jawaban yang udah ada, bukan gantiin jawabannya.
function buildImplicitInterestNudge(project: ProjectRow): BotPart {
  const tipeName = extractTipeName(project.spec);
  const label = tipeName ? `Tipe ${tipeName}` : project.nama_cluster;
  return {
    text: `Kayaknya kakak beneran tertarik sama ${label} nih 😊 Mau Ivy jadwalkan survey ke lokasi? Kakak free kapan, weekday atau weekend?`,
  };
}

const INTEREST_KEYWORDS = ["tertarik", "minat"];

const OTHER_OPTIONS_KEYWORDS = [
  "rumah lain",
  "properti lain",
  "yang lain",
  "pilihan lain",
  "unit lain",
  "opsi lain",
  "ada lagi",
];

// customer nunjukin minat ("tertarik", "minat") ke properti yang lagi jadi
// konteks obrolan -> jangan kasih script closing generik, langsung giring
// ke tujuan akhir: tawarin jadwal survey ke unit yang dia minati.
function buildSurveyOffer(project: ProjectRow): SegmentResult {
  const tipeName = extractTipeName(project.spec);
  const label = tipeName ? `Tipe ${tipeName}` : project.nama_cluster;

  return {
    parts: [
      {
        text: `Mantap kak! 🎉 Kalau kakak tertarik ${label}, mau Ivy jadwalkan survey ke lokasi? Kakak free kapan, weekday atau weekend? 😊`,
      },
    ],
    cluster: project.nama_cluster,
    project,
    surveyOffered: true,
  };
}

// customer nyebut nama tipe doang tanpa maksud spesifik (bukan nanya
// lokasi/KPR/foto) -> kasih ringkasan spec unit itu + pancing pertanyaan
// lanjutan, sambil pindahin konteks obrolan ke unit ini.
function buildTipeOverview(project: ProjectRow): SegmentResult {
  const tipeName = extractTipeName(project.spec);
  const label = tipeName ? `Tipe ${tipeName}` : project.nama_cluster;
  const specLine = [project.nama_cluster, project.daerah].filter(Boolean).join(" — ");
  const specLines = project.spec ? parseSpecLines(project.spec) : ["(spec belum diisi)"];

  return {
    parts: [
      { text: `${label} kak, nih detailnya:` },
      { text: formatPropertyBlock(specLine, specLines) },
      { text: "Mau Ivy infoin lokasi, simulasi KPR, atau foto/videonya kak? 😊" },
    ],
    cluster: project.nama_cluster,
    project,
  };
}

function handleSegment(
  segment: string,
  qnaRows: QnaRow[],
  projectRows: ProjectRow[],
  activeCluster: string | null,
  activeProject: ProjectRow | null,
  sharedProjectIds: Set<string>
): SegmentResult {
  const lower = segment.toLowerCase();
  const isPhotoReq = PHOTO_KEYWORDS.some((k) => lower.includes(k));
  const isVideoReq = VIDEO_KEYWORDS.some((k) => lower.includes(k));
  const isLocationReq = LOCATION_KEYWORDS.some((k) => lower.includes(k));
  const isKprFeasibilityReq = KPR_FEASIBILITY_KEYWORDS.some((k) => lower.includes(k));
  const isInterestReq = INTEREST_KEYWORDS.some((k) => lower.includes(k));

  // nyebut nama tipe spesifik itu sinyal paling kuat -- harus selalu dibaca
  // & menang atas konteks obrolan sebelumnya (activeProject/activeCluster),
  // apapun bentuk pertanyaannya, biar context nggak "stuck" di unit lama.
  const tipeMention = findProjectByTipeName(segment, projectRows);
  if (tipeMention) {
    if (isLocationReq && !isPhotoReq && !isVideoReq) {
      return buildLocationAnswer(tipeMention, extractTipeName(tipeMention.spec));
    }
    if (isKprFeasibilityReq) {
      return buildKprFeasibilityAnswer(tipeMention, tipeMention.nama_cluster, projectRows);
    }
    if (isPhotoReq || isVideoReq) {
      return shareListingOrNudge(
        [tipeMention],
        tipeMention.nama_cluster,
        isVideoReq ? "video" : "foto",
        sharedProjectIds,
        tipeMention
      );
    }
    if (isInterestReq) {
      return buildSurveyOffer(tipeMention);
    }
    // disebut doang tanpa maksud spesifik -> kasih ringkasan unitnya
    return buildTipeOverview(tipeMention);
  }

  // nanya lokasi cluster/daerah (tanpa nyebut tipe) -> jawab lokasi +
  // kelebihannya aja, jangan nge-list semua project.
  if (isLocationReq && !isPhotoReq && !isVideoReq) {
    const mention = findProjectMention(segment, projectRows);
    if (mention) {
      return buildLocationAnswer(mention.project, mention.tipeName);
    }

    // gak nyebut project eksplisit di pesan ini -> pakai konteks obrolan
    // sebelumnya (activeProject/activeCluster), jangan jatuh ke QnA umum
    // yang jawabnya list semua cluster.
    if (activeProject) {
      return buildLocationAnswer(activeProject, extractTipeName(activeProject.spec));
    }
    if (activeCluster) {
      const contextProject = projectRows.find(
        (p) => p.nama_cluster.trim().toLowerCase() === activeCluster.toLowerCase()
      );
      if (contextProject) {
        return buildLocationAnswer(contextProject, null);
      }
    }
  }

  // "bisa KPR?" itu nanya kelayakan KPR utk properti yang lagi dibahas --
  // cek konteks obrolan sebelumnya (activeProject/activeCluster) dulu
  // sebelum jatuh ke QnA umum, supaya jawabannya spesifik ke properti itu.
  if (isKprFeasibilityReq) {
    return buildKprFeasibilityAnswer(activeProject, activeCluster, projectRows);
  }

  // "ada bonus apa aja?" -> kalau ada properti/cluster eksplisit di pesan
  // ini atau konteks obrolan sebelumnya, jawab bonus punya properti itu aja.
  // Kalau nggak ada konteks sama sekali, biarin jatuh ke QnA umum (qna bonus).
  const isBonusReq = BONUS_KEYWORDS.some((k) => lower.includes(k));
  if (isBonusReq) {
    const explicitProject = findProjectMention(segment, projectRows)?.project;
    const contextProject =
      explicitProject ??
      activeProject ??
      (activeCluster
        ? projectRows.find((p) => p.nama_cluster.trim().toLowerCase() === activeCluster.toLowerCase())
        : null);
    if (contextProject) {
      const bonusAnswer = buildBonusAnswer(contextProject);
      if (bonusAnswer) return bonusAnswer;
    }
  }

  // "harga/cicilan berapa?" -> sama kayak bonus, jawab sesuai properti
  // eksplisit di pesan ini atau konteks obrolan, jangan asal ketiban jawaban
  // cluster lain gara-gara tie-break keyword generik.
  const isPriceReq = PRICE_KEYWORDS.some((k) => lower.includes(k));
  if (isPriceReq) {
    const explicitProject = findProjectMention(segment, projectRows)?.project;
    const contextProject =
      explicitProject ??
      activeProject ??
      (activeCluster
        ? projectRows.find((p) => p.nama_cluster.trim().toLowerCase() === activeCluster.toLowerCase())
        : null);
    if (contextProject) {
      const priceAnswer = buildPriceAnswer(contextProject);
      if (priceAnswer) return priceAnswer;
    }
  }

  // customer nunjukin minat tanpa nyebut nama tipe/cluster di pesan ini ->
  // pakai konteks obrolan buat langsung giring ke tawaran survey.
  if (isInterestReq) {
    const contextProject =
      activeProject ??
      (activeCluster
        ? projectRows.find((p) => p.nama_cluster.trim().toLowerCase() === activeCluster.toLowerCase())
        : null);
    if (contextProject) {
      return buildSurveyOffer(contextProject);
    }
  }

  // "ada rumah/unit lain nggak?" -> share unit LAIN di cluster yang sama
  // (bukan ngulang unit yang lagi jadi konteks), bukan nge-list ulang
  // properti yang udah dibahas.
  const isOtherOptionsReq = OTHER_OPTIONS_KEYWORDS.some((k) => lower.includes(k));
  if (isOtherOptionsReq) {
    const clusterName = activeProject?.nama_cluster ?? activeCluster;
    if (clusterName) {
      const others = projectRows.filter(
        (p) =>
          p.nama_cluster.trim().toLowerCase() === clusterName.toLowerCase() &&
          (!activeProject || p.id !== activeProject.id)
      );
      if (others.length > 0) {
        return buildOtherOptionsListing(others, clusterName);
      }
      return {
        parts: [
          {
            text: `Untuk sementara di ${clusterName} baru unit itu aja kak yang ready, tapi kalau kakak mau lihat cluster lain juga boleh! 😊`,
          },
        ],
        cluster: clusterName,
      };
    }
  }

  // sebut nama cluster/daerah eksplisit -> selalu tampilkan listing foto+spec
  const areaMention = findProjectsByAreaMention(segment, projectRows);
  if (areaMention) {
    return shareListingOrNudge(
      areaMention.matches,
      areaMention.label,
      isVideoReq ? "video" : "foto",
      sharedProjectIds,
      activeProject
    );
  }

  // jawab area mobilisasi sehari-hari (bukan nama cluster resmi) -> rekomendasikan
  // cluster yang aksesnya paling deket ke area itu.
  const proximity = findClusterByProximity(segment);
  if (proximity) {
    return buildMobilityRecommendation(proximity, projectRows, activeCluster, activeProject, sharedProjectIds);
  }

  // minta foto/video tanpa sebut nama -> kalau lagi fokus ke 1 unit spesifik
  // (activeProject), share unit itu AJA, jangan seluruh cluster. Baru kalau
  // belum ada unit spesifik, pakai konteks cluster dari histori chat.
  if (isPhotoReq || isVideoReq) {
    const kind = isVideoReq ? "video" : "foto";
    const matches = activeProject
      ? [activeProject]
      : activeCluster
        ? projectRows.filter((p) => p.nama_cluster.trim().toLowerCase() === activeCluster.toLowerCase())
        : [];

    if (matches.length === 0) {
      return {
        parts: [
          {
            text: `Properti yang mana ya kak? Boleh sebutkan nama cluster atau daerahnya dulu baru aku kirimkan ${kind}-nya.`,
          },
        ],
      };
    }

    const label = activeProject ? activeProject.nama_cluster : (activeCluster as string);
    return shareListingOrNudge(matches, label, kind, sharedProjectIds, activeProject);
  }

  const match = findBestMatch(segment, qnaRows);
  if (match) {
    return {
      parts: [{ text: applyIvyVoice(match.row.jawaban), meta: metaFor(match) }],
      cluster: match.row.nama_cluster || undefined,
    };
  }

  return { parts: [{ text: FALLBACK_TEXT }] };
}

const INTEREST_THRESHOLD = 3;

function buildReply(
  message: string,
  qnaRows: QnaRow[],
  projectRows: ProjectRow[],
  activeCluster: string | null,
  activeProject: ProjectRow | null,
  sharedProjectIds: Set<string>,
  inquiryCounts: Map<string, number>,
  surveyOffered: Set<string>
): {
  parts: BotPart[];
  nextActiveCluster: string | null;
  nextActiveProject: ProjectRow | null;
  nextSharedProjectIds: Set<string>;
  nextInquiryCounts: Map<string, number>;
  nextSurveyOffered: Set<string>;
} {
  const questions = splitQuestions(message);
  let cluster = activeCluster;
  let project = activeProject;
  const shared = new Set(sharedProjectIds);
  const counts = new Map(inquiryCounts);
  const offered = new Set(surveyOffered);
  const allParts: BotPart[] = [];

  if (detectAnger(message)) {
    allParts.push({ text: "Aduh, maaf banget ya kak atas ketidaknyamanannya. 🙏" });
  }

  for (const question of questions) {
    const result = handleSegment(question, qnaRows, projectRows, cluster, project, shared);
    const parts = [...result.parts];

    if (result.project) {
      const id = result.project.id;
      if (result.surveyOffered) {
        offered.add(id);
      } else {
        const newCount = (counts.get(id) ?? 0) + 1;
        counts.set(id, newCount);
        // customer udah nanya properti spesifik ini >= 3x (KPR, lokasi,
        // bonus, dst) tanpa pernah bilang "tertarik" -> itu minat implisit,
        // sambungin nudge survey ke jawaban yang udah ada (sekali aja).
        if (newCount >= INTEREST_THRESHOLD && !offered.has(id)) {
          offered.add(id);
          parts.push(buildImplicitInterestNudge(result.project));
        }
      }
    }

    allParts.push(...parts);
    if (result.project) {
      project = result.project;
      cluster = result.project.nama_cluster;
    } else if (result.cluster) {
      // pindah ke cluster lain -> unit spesifik yang lagi dibahas jadi
      // ambigu lagi, jangan dipakai buat jawaban KPR berikutnya.
      if (result.cluster !== cluster) project = null;
      cluster = result.cluster;
    }
    if (result.sharedProjectIds) {
      for (const id of result.sharedProjectIds) shared.add(id);
    }
  }

  return {
    parts: allParts,
    nextActiveCluster: cluster,
    nextActiveProject: project,
    nextSharedProjectIds: shared,
    nextInquiryCounts: counts,
    nextSurveyOffered: offered,
  };
}

export default function TestChat({
  initialQna,
  initialProjects,
}: {
  initialQna: QnaRow[];
  initialProjects: ProjectRow[];
}) {
  const [qnaRows, setQnaRows] = useState<QnaRow[]>(initialQna);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>(initialProjects);
  const [activeCluster, setActiveCluster] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectRow | null>(null);
  const [sharedProjectIds, setSharedProjectIds] = useState<Set<string>>(new Set());
  const [inquiryCounts, setInquiryCounts] = useState<Map<string, number>>(new Map());
  const [surveyOffered, setSurveyOffered] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Halo kak! Aku Ivy dari CariProperti. Ini simulasi buat ngecek apakah jawaban dan foto/video dari database sudah kepanggil dengan benar. Coba tanya sesuatu ya, boleh lebih dari satu pertanyaan sekaligus, atau tanya properti di area/cluster tertentu!",
    },
  ]);
  const [input, setInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function refreshData() {
    setRefreshing(true);
    try {
      const [qnaRes, projectRes] = await Promise.all([
        fetch("/api/qna"),
        fetch("/api/projects"),
      ]);
      const qnaJson = await qnaRes.json();
      const projectJson = await projectRes.json();
      if (qnaRes.ok && qnaJson.success) setQnaRows(qnaJson.data);
      if (projectRes.ok && projectJson.success) setProjectRows(projectJson.data);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: "user", text };
    const reply = buildReply(
      text,
      qnaRows,
      projectRows,
      activeCluster,
      activeProject,
      sharedProjectIds,
      inquiryCounts,
      surveyOffered
    );
    const botMsgs: ChatMessage[] = reply.parts.map((part, i) => ({
      id: `b-${Date.now()}-${i}`,
      sender: "bot",
      text: part.text,
      images: part.images,
      meta: part.meta,
    }));

    setActiveCluster(reply.nextActiveCluster);
    setActiveProject(reply.nextActiveProject);
    setSharedProjectIds(reply.nextSharedProjectIds);
    setInquiryCounts(reply.nextInquiryCounts);
    setSurveyOffered(reply.nextSurveyOffered);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // pesan bot muncul satu-satu dengan jeda ~2 detik kalau lebih dari 1
    // bagian (mis. share beberapa unit properti sekaligus), biar kesannya
    // Ivy lagi nyari data satu-satu kayak agen beneran, bukan auto-reply.
    setSending(true);
    for (let i = 0; i < botMsgs.length; i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
      const msg = botMsgs[i];
      setMessages((prev) => [...prev, msg]);
    }
    setSending(false);
  }

  const activeCount = qnaRows.filter((r) => r.aktif).length;

  return (
    <div className="flex min-h-[360px] w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-navy/10 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-navy/10 bg-navy px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-navy">
            <IconUser className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">
              Ivy<span className="hidden sm:inline"> — Sales Agent CariProperti</span>
            </p>
            <p className="truncate text-xs text-white/60">
              {activeCount} QnA aktif • {projectRows.length} properti
              {activeProject
                ? ` • konteks: ${extractTipeName(activeProject.spec) ? `Tipe ${extractTipeName(activeProject.spec)} (${activeProject.nama_cluster})` : activeProject.nama_cluster}`
                : activeCluster
                  ? ` • konteks: ${activeCluster}`
                  : ""}
            </p>
          </div>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="shrink-0 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
        >
          {refreshing ? "Memuat..." : "Refresh Data"}
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-background/70 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                msg.sender === "user"
                  ? "rounded-br-sm bg-teal text-white"
                  : "rounded-bl-sm border border-navy/10 bg-white text-ink"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.images && msg.images.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {msg.images.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt="Foto properti"
                      className="h-24 w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              {msg.meta && (
                <p
                  className={`mt-1 text-[11px] ${
                    msg.sender === "user" ? "text-white/70" : "text-ink/40"
                  }`}
                >
                  {msg.meta}
                </p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex min-w-0 items-center gap-2 border-t border-navy/10 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pertanyaan seperti calon customer..."
          disabled={sending}
          className="min-w-0 flex-1 rounded-full border border-navy/20 px-4 py-2 text-base outline-none focus:border-teal focus:ring-1 focus:ring-teal disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
        >
          <IconSend className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
