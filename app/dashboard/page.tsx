import Link from "next/link";
import { listProjects, listQna } from "@/lib/sheets";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";
import { getDisplayName } from "@/lib/display-name";
import GlobalSearch from "@/components/GlobalSearch";
import DashboardKpiCards from "@/components/DashboardKpiCards";
import {
  IconArrowRight,
  IconBuilding,
  IconEdit,
  IconShield,
  IconSparkle,
} from "@/components/icons";

export default async function DashboardOverviewPage() {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const [qna, projects] = await Promise.all([listQna(), listProjects()]);

  const uniqueClusters = new Set(
    [...qna.map((r) => r.nama_cluster), ...projects.map((r) => r.nama_cluster)]
      .map((c) => c.trim())
      .filter(Boolean)
  );

  const quickLinks = [
    {
      href: "/dashboard/qna",
      label: "Knowledge Base",
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

      <DashboardKpiCards qna={qna} projects={projects} />

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
