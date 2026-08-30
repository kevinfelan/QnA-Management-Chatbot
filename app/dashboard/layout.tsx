import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";
import { getDisplayName } from "@/lib/display-name";
import Sidebar from "@/components/Sidebar";
import DashboardNav from "@/components/DashboardNav";
import LogoutButton from "@/components/LogoutButton";
import PullToRefresh from "@/components/PullToRefresh";
import { IconRobotLogo } from "@/components/icons";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const admin = isAdmin(session.user);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isAdmin={admin} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile: navy + logo, ala Nasi Panggang Baiti */}
        <header
          className="flex shrink-0 items-center gap-3 bg-navy px-4 pb-3 text-white shadow-md md:hidden"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold text-navy">
            <IconRobotLogo className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-heading text-base font-semibold">QnA Setup</p>
            <p className="truncate text-xs text-white/60">
              Selamat datang, {getDisplayName(session.user)}
            </p>
          </div>
          <LogoutButton />
        </header>

        {/* Header desktop: tetap seperti semula */}
        <header
          className="hidden shrink-0 items-center justify-between gap-3 border-b border-navy/10 bg-white px-4 pb-4 sm:px-6 md:flex"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="min-w-0">
            <p className="text-xs text-ink/50">Selamat datang,</p>
            <p className="truncate font-heading text-base font-semibold text-navy">
              {getDisplayName(session.user)}
            </p>
          </div>
          <LogoutButton onDark={false} />
        </header>

        <PullToRefresh className="px-4 py-6 pb-28 sm:px-6 md:pb-6">{children}</PullToRefresh>

        <DashboardNav isAdmin={admin} />
      </div>
    </div>
  );
}
