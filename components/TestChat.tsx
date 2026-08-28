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

function findProjectByMention(segment: string, projects: ProjectRow[]): ProjectRow | null {
  const lower = segment.toLowerCase();
  return (
    projects.find((p) => {
      const cluster = p.nama_cluster.trim().toLowerCase();
      return cluster && lower.includes(cluster);
    }) || null
  );
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
  text: string;
  images?: string[];
  meta?: string;
  cluster?: string;
};

function handleMediaRequest(
  segment: string,
  kind: "foto" | "video",
  projects: ProjectRow[],
  activeCluster: string | null
): SegmentResult {
  const targetClusterName = findProjectByMention(segment, projects)?.nama_cluster ?? activeCluster;

  if (!targetClusterName) {
    return {
      text: `Properti yang mana ya kak? Boleh sebutkan nama cluster-nya dulu baru aku kirimkan ${kind}-nya.`,
    };
  }

  const targets = projects.filter(
    (p) => p.nama_cluster.trim().toLowerCase() === targetClusterName.toLowerCase()
  );
  const withMedia = targets.filter(
    (p) => parseUrls(kind === "foto" ? p.foto_url : p.video_url).length > 0
  );

  if (withMedia.length === 0) {
    return {
      text: `Waduh, ${kind} untuk ${targetClusterName} belum ada di database kak, nanti aku infokan ke tim ya.`,
      cluster: targetClusterName,
    };
  }

  const images: string[] = [];
  const introLine =
    kind === "foto"
      ? `Ini fotonya ya kak, unit di ${targetClusterName}:`
      : `Ini videonya ya kak, unit di ${targetClusterName}:`;
  const detailLines = withMedia.map((p, i) => {
    const urls = parseUrls(kind === "foto" ? p.foto_url : p.video_url);
    if (kind === "foto") images.push(...urls);
    return `Unit ${i + 1}${p.spec ? ` — ${p.spec}` : ""}`;
  });

  return {
    text: [introLine, ...detailLines].join("\n"),
    images: kind === "foto" ? images : undefined,
    meta:
      kind === "video"
        ? withMedia.flatMap((p) => parseUrls(p.video_url)).join(", ")
        : undefined,
    cluster: targetClusterName,
  };
}

function handleSegment(
  segment: string,
  qnaRows: QnaRow[],
  projectRows: ProjectRow[],
  activeCluster: string | null
): SegmentResult {
  const lower = segment.toLowerCase();

  if (PHOTO_KEYWORDS.some((k) => lower.includes(k))) {
    return handleMediaRequest(segment, "foto", projectRows, activeCluster);
  }

  if (VIDEO_KEYWORDS.some((k) => lower.includes(k))) {
    return handleMediaRequest(segment, "video", projectRows, activeCluster);
  }

  const match = findBestMatch(segment, qnaRows);
  if (match) {
    return {
      text: applyIvyVoice(match.row.jawaban),
      meta: metaFor(match),
      cluster: match.row.nama_cluster || undefined,
    };
  }

  return { text: FALLBACK_TEXT };
}

function buildReply(
  message: string,
  qnaRows: QnaRow[],
  projectRows: ProjectRow[],
  activeCluster: string | null
): { text: string; images: string[]; meta?: string; nextActiveCluster: string | null } {
  const questions = splitQuestions(message);
  const answered: string[] = [];
  const images: string[] = [];
  const metaParts: string[] = [];
  let cluster = activeCluster;

  for (const question of questions) {
    const result = handleSegment(question, qnaRows, projectRows, cluster);
    answered.push(result.text);
    if (result.images) images.push(...result.images);
    if (result.meta) metaParts.push(result.meta);
    if (result.cluster) cluster = result.cluster;
  }

  const deduped = answered.filter((text, i) => text !== answered[i - 1]);

  const angry = detectAnger(message);
  const apology = "Aduh, maaf banget ya kak atas ketidaknyamanannya. 🙏";
  const text = angry ? [apology, ...deduped].join("\n\n") : deduped.join("\n\n");

  return {
    text,
    images,
    meta: metaParts.length > 0 ? metaParts.join(" | ") : undefined,
    nextActiveCluster: cluster,
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Halo kak! Aku Ivy dari CariProperti. Ini simulasi buat ngecek apakah jawaban dan foto/video dari database sudah kepanggil dengan benar. Coba tanya sesuatu ya, boleh lebih dari satu pertanyaan sekaligus, atau minta foto/video propertinya!",
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
    const botMsg: ChatMessage = {
      id: `b-${Date.now()}`,
      sender: "bot",
      text: reply.text,
      meta: reply.meta,
      images: reply.images.length > 0 ? reply.images : undefined,
    };

    setActiveCluster(reply.nextActiveCluster);
    setMessages((prev) => [...prev, userMsg, botMsg]);
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
