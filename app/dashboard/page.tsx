import Link from "next/link";
import { listProjects, listQna } from "@/lib/sheets";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";
import { getDisplayName } from "@/lib/display-name";
import GlobalSearch from "@/components/GlobalSearch";
import {
  IconArrowRight,
  IconBuilding,
  IconEdit,
  IconLayers,
  IconMessage,
  IconShield,
  IconSparkle,
  IconTag,
} from "@/components/icons";

export default async function DashboardOverviewPage() {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const [qna, projects] = await Promise.all([listQna(), listProjects()]);

  const totalPertanyaan = qna.length;

  const uniqueKeywords = new Set(
    qna.flatMap((row) =>
      row.kata_kunci
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const uniqueKategori = new Set(
    qna.map((row) => row.kategori.trim()).filter(Boolean)
  );

  const uniqueClusters = new Set(
    [...qna.map((r) => r.nama_cluster), ...projects.map((r) => r.nama_cluster)]
      .map((c) => c.trim())
      .filter(Boolean)
  );

  // Gradasi tiap kartu KPI: turunan warna palette fantasy adventure kita
  // sendiri (teal & navy = hijau, gold & cocoa = coklat muda) -- bukan warna
  // dari app referensi, cuma pola kartunya yang dicontek.
  const stats = [
    {
      label: "Kata Kunci Unik",
      value: uniqueKeywords.size,
      Icon: IconTag,
      gradient: "from-teal to-[#35553A]",
    },
    {
      label: "Pertanyaan Tersimpan",
      value: totalPertanyaan,
      Icon: IconMessage,
      gradient: "from-[#B8865A] to-[#815E3F]",
    },
    {
      label: "Format Jawaban (Kategori)",
      value: uniqueKategori.size,
      Icon: IconLayers,
      gradient: "from-gold to-[#8D7135]",
    },
    {
      label: "Database Properti",
      value: projects.length,
      Icon: IconBuilding,
      gradient: "from-navy to-[#21352A]",
    },
  ];

  const quickLinks = [
    {
      href: "/dashboard/qna",
      label: "Input QnA",
      desc: "Kelola pertanyaan & jawaban chatbot",
      Icon: IconEdit,
    },
    {
      href: "/dashboard/projects",
      label: "Database Project",
      desc: "Kelola data cluster & properti",
      Icon: IconBuilding,
    },
    ...(isAdmin(session?.user)
      ? [
          {
            href: "/dashboard/admin",
            label: "Admin",
            desc: "Undang user & atur role",
            Icon: IconShield,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="relative overflow-hidden rounded-xl bg-navy p-4 text-white sm:p-5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/20" />
        <div className="pointer-events-none absolute -right-2 bottom-[-1.5rem] h-16 w-16 rounded-full bg-teal/25" />
        <div className="relative flex flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-gold">
            <IconSparkle className="h-3 w-3" />
            Ringkasan
          </span>
          <h1 className="break-words font-heading text-lg font-bold sm:text-xl">
            Selamat datang{getDisplayName(session?.user) ? "," : ""}{" "}
            {getDisplayName(session?.user)}
          </h1>
          <p className="max-w-xl text-xs text-white/70">
            Pantau data QnA dan database properti chatbot WhatsApp dari satu
            tempat
            {uniqueClusters.size > 0
              ? `, tersebar di ${uniqueClusters.size} cluster.`
              : "."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl bg-gradient-to-br p-4 text-white shadow-sm ${s.gradient}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-white/80">{s.label}</span>
              <s.Icon className="h-5 w-5 shrink-0 text-white/70" />
            </div>
            <p className="mt-3 font-heading text-3xl font-semibold leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 rounded-xl border border-navy/10 bg-white p-3 transition-colors hover:border-teal/40 hover:bg-teal/5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy text-gold">
              <link.Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-semibold text-navy">{link.label}</p>
              <p className="truncate text-xs text-ink/60">{link.desc}</p>
            </div>
            <IconArrowRight className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-teal" />
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6">
        <h2 className="mb-3 font-heading text-lg font-semibold text-navy">Pencarian Cepat</h2>
        <GlobalSearch qna={qna} projects={projects} />
      </div>
    </div>
  );
}
