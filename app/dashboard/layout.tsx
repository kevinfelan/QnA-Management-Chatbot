import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/roles";
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

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between bg-navy px-4 py-4 sm:px-6">
        <div>
          <h1 className="font-heading text-lg font-semibold text-white sm:text-xl">
            QnA Setup
          </h1>
          <p className="text-xs text-white/60">{session.user.email}</p>
        </div>
        <LogoutButton />
      </header>

      <DashboardNav isAdmin={isAdmin(session.user)} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
