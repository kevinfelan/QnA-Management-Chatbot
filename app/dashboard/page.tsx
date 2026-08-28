import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { listQna } from "@/lib/sheets";
import QnaTable from "@/components/QnaTable";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const data = await listQna();

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

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <QnaTable initialData={data} />
      </main>
    </div>
  );
}
