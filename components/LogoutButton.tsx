"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-client";

export default function LogoutButton({ onDark = true }: { onDark?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
        onDark
          ? "border-white/20 text-white hover:bg-white/10"
          : "border-navy/20 text-navy hover:bg-navy/5"
      }`}
    >
      {loading ? "Keluar..." : "Keluar"}
    </button>
  );
}
