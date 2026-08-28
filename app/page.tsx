import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";

export default async function RootPage() {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  redirect(session ? "/dashboard" : "/login");
}
