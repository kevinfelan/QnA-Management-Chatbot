import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";
import { getDisplayName } from "@/lib/display-name";
import Sidebar from "@/components/Sidebar";
import DashboardNav from "@/components/DashboardNav";
import LogoutButton from "@/components/LogoutButton";
import PullToRefresh from "@/components/PullToRefresh";

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
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar isAdmin={admin} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center justify-between gap-3 border-b border-navy/10 bg-white px-4 pb-4 sm:px-6"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="min-w-0">
            <p className="text-xs text-ink/50">Selamat datang,</p>
            <p className="truncate font-heading text-base font-semibold text-navy">
              {getDisplayName(session.user)}
            </p>
          </div>
          <LogoutButton />
        </header>

        <PullToRefresh className="px-4 py-6 sm:px-6">{children}</PullToRefresh>

        <DashboardNav isAdmin={admin} />
      </div>
    </div>
  );
}
