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

  const stats = [
    {
      label: "Kata Kunci Unik",
      value: uniqueKeywords.size,
      Icon: IconTag,
      accent: "bg-teal/10 text-teal",
    },
    {
      label: "Pertanyaan Tersimpan",
      value: totalPertanyaan,
      Icon: IconMessage,
      accent: "bg-navy/10 text-navy",
    },
    {
      label: "Format Jawaban (Kategori)",
      value: uniqueKategori.size,
      Icon: IconLayers,
      accent: "bg-gold/20 text-gold",
    },
    {
      label: "Database Properti",
      value: projects.length,
      Icon: IconBuilding,
      accent: "bg-teal/10 text-teal",
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
      <div className="relative overflow-hidden rounded-xl bg-navy p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-gold/20" />
        <div className="pointer-events-none absolute -right-2 bottom-[-2.5rem] h-28 w-28 rounded-full bg-teal/25" />
        <div className="relative flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold">
            <IconSparkle className="h-3.5 w-3.5" />
            Ringkasan
          </span>
          <h1 className="break-words font-heading text-2xl font-bold sm:text-3xl">
            Selamat datang{getDisplayName(session?.user) ? "," : ""}{" "}
            {getDisplayName(session?.user)}
          </h1>
          <p className="max-w-xl text-sm text-white/70">
            Pantau data QnA dan database properti chatbot WhatsApp dari satu
            tempat
            {uniqueClusters.size > 0
              ? `, tersebar di ${uniqueClusters.size} cluster.`
              : "."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-navy/10 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.accent}`}>
              <s.Icon className="h-5 w-5" />
            </div>
            <p className="mt-4 font-heading text-3xl font-semibold text-navy">{s.value}</p>
            <p className="mt-1 text-sm text-ink/60">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-4 rounded-xl border border-navy/10 bg-white p-5 transition-colors hover:border-teal/40 hover:bg-teal/5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-navy text-gold">
              <link.Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-heading font-semibold text-navy">{link.label}</p>
              <p className="text-xs text-ink/60">{link.desc}</p>
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
