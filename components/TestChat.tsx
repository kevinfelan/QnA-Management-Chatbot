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

// intro "ada N project nih kak..." lalu 1 pesan terpisah per unit (foto+spec).
function buildAreaListing(
  matches: ProjectRow[],
  areaLabel: string,
  kind: "foto" | "video"
): SegmentResult {
  const withMedia = matches.filter(
    (p) => parseUrls(kind === "foto" ? p.foto_url : p.video_url).length > 0
  );
  const list = withMedia.length > 0 ? withMedia : matches;

  const parts: BotPart[] = [
    {
      text: `Ada ${list.length} project nih kak di ${areaLabel}, wait ya Ivy kirim info projectnya.`,
    },
  ];

  for (const p of list) {
    const urls = parseUrls(kind === "foto" ? p.foto_url : p.video_url);
    const specLine = [p.nama_cluster, p.daerah].filter(Boolean).join(" — ");
    const specLines = p.spec ? parseSpecLines(p.spec) : ["(spec belum diisi)"];
    parts.push({
      text: [specLine, ...specLines].filter(Boolean).join("\n"),
      images: kind === "foto" && urls.length > 0 ? urls : undefined,
      meta: kind === "video" && urls.length > 0 ? urls.join(", ") : undefined,
    });
  }

  return { parts, cluster: matches[0]?.nama_cluster };
}

function handleSegment(
  segment: string,
  qnaRows: QnaRow[],
  projectRows: ProjectRow[],
  activeCluster: string | null
): SegmentResult {
  const lower = segment.toLowerCase();
  const isPhotoReq = PHOTO_KEYWORDS.some((k) => lower.includes(k));
  const isVideoReq = VIDEO_KEYWORDS.some((k) => lower.includes(k));

  // sebut nama cluster/daerah eksplisit -> selalu tampilkan listing foto+spec
  const areaMention = findProjectsByAreaMention(segment, projectRows);
  if (areaMention) {
    return buildAreaListing(areaMention.matches, areaMention.label, isVideoReq ? "video" : "foto");
  }

  // minta foto/video tanpa sebut nama -> pakai konteks cluster dari histori chat
  if (isPhotoReq || isVideoReq) {
    const kind = isVideoReq ? "video" : "foto";
    const matches = activeCluster
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

    return buildAreaListing(matches, activeCluster as string, kind);
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

function buildReply(
  message: string,
  qnaRows: QnaRow[],
  projectRows: ProjectRow[],
  activeCluster: string | null
): { parts: BotPart[]; nextActiveCluster: string | null } {
  const questions = splitQuestions(message);
  let cluster = activeCluster;
  const allParts: BotPart[] = [];

  if (detectAnger(message)) {
    allParts.push({ text: "Aduh, maaf banget ya kak atas ketidaknyamanannya. 🙏" });
  }

  for (const question of questions) {
    const result = handleSegment(question, qnaRows, projectRows, cluster);
    allParts.push(...result.parts);
    if (result.cluster) cluster = result.cluster;
  }

  return { parts: allParts, nextActiveCluster: cluster };
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Halo kak! Aku Ivy dari CariProperti. Ini simulasi buat ngecek apakah jawaban dan foto/video dari database sudah kepanggil dengan benar. Coba tanya sesuatu ya, boleh lebih dari satu pertanyaan sekaligus, atau tanya properti di area/cluster tertentu!",
    },
  ]);
  const [input, setInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);
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

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: "user", text };
    const reply = buildReply(text, qnaRows, projectRows, activeCluster);
    const botMsgs: ChatMessage[] = reply.parts.map((part, i) => ({
      id: `b-${Date.now()}-${i}`,
      sender: "bot",
      text: part.text,
      images: part.images,
      meta: part.meta,
    }));

    setActiveCluster(reply.nextActiveCluster);
    setMessages((prev) => [...prev, userMsg, ...botMsgs]);
    setInput("");
  }

  const activeCount = qnaRows.filter((r) => r.aktif).length;

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-navy/10 bg-white">
      <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-navy">
            <IconUser className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold">Ivy — Sales Agent CariProperti</p>
            <p className="text-xs text-white/60">
              {activeCount} QnA aktif • {projectRows.length} properti
              {activeCluster ? ` • konteks: ${activeCluster}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
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
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
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

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-navy/10 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pertanyaan seperti calon customer..."
          className="flex-1 rounded-full border border-navy/20 px-4 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-white hover:bg-teal/90"
        >
          <IconSend className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
