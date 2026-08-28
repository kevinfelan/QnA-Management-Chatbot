"use client";

import { useEffect, useRef, useState } from "react";
import type { QnaRow } from "@/lib/sheets";
import { IconSend, IconUser } from "./icons";

type ChatMessage = {
  id: string;
  sender: "user" | "bot";
  text: string;
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

function buildReply(message: string, rows: QnaRow[]): { text: string; meta?: string } {
  const questions = splitQuestions(message);
  const answered: string[] = [];
  const metaParts: string[] = [];

  for (const question of questions) {
    const match = findBestMatch(question, rows);
    if (match) {
      answered.push(applyIvyVoice(match.row.jawaban));
      metaParts.push(metaFor(match));
    } else {
      answered.push(FALLBACK_TEXT);
    }
  }

  // dedupe jawaban identik berturut-turut (kalau beberapa segmen match row yang sama)
  const deduped = answered.filter((text, i) => text !== answered[i - 1]);

  const angry = detectAnger(message);
  const apology = "Aduh, maaf banget ya kak atas ketidaknyamanannya. 🙏";

  const text = angry ? [apology, ...deduped].join("\n\n") : deduped.join("\n\n");

  return {
    text,
    meta: metaParts.length > 0 ? metaParts.join(" | ") : undefined,
  };
}

export default function TestChat({ initialData }: { initialData: QnaRow[] }) {
  const [rows, setRows] = useState<QnaRow[]>(initialData);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Halo kak! Aku Ivy dari CariProperti. Ini simulasi buat ngecek apakah jawaban dari database sudah kepanggil dengan benar. Coba tanya sesuatu ya, boleh lebih dari satu pertanyaan sekaligus!",
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
      const res = await fetch("/api/qna");
      const json = await res.json();
      if (res.ok && json.success) {
        setRows(json.data);
      }
    } finally {
      setRefreshing(false);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: "user", text };
    const reply = buildReply(text, rows);
    const botMsg: ChatMessage = {
      id: `b-${Date.now()}`,
      sender: "bot",
      text: reply.text,
      meta: reply.meta,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
  }

  const activeCount = rows.filter((r) => r.aktif).length;

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-navy/10 bg-white">
      <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-navy">
            <IconUser className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold">Ivy — Sales Agent CariProperti</p>
            <p className="text-xs text-white/60">{activeCount} QnA aktif dimuat</p>
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
