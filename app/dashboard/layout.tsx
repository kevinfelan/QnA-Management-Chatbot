import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";
import { getDisplayName } from "@/lib/display-name";
import Sidebar from "@/components/Sidebar";
import DashboardNav from "@/components/DashboardNav";
import LogoutButton from "@/components/LogoutButton";

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
        <header className="flex items-center justify-between gap-3 border-b border-navy/10 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-ink/50">Selamat datang,</p>
            <p className="truncate font-heading text-base font-semibold text-navy">
              {getDisplayName(session.user)}
            </p>
          </div>
          <LogoutButton />
        </header>

        <DashboardNav isAdmin={admin} />

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
