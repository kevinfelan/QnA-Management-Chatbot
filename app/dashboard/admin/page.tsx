import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminSupabase } from "@/lib/supabase-admin";
import { isAdmin, getRole } from "@/lib/roles";
import AdminPanel, { type AdminUser } from "@/components/AdminPanel";

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session.user)) {
    redirect("/dashboard");
  }

  let users: AdminUser[] = [];
  let loadError: string | null = null;

  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) throw error;

    users = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      role: getRole(u),
      created_at: u.created_at,
    }));
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat daftar user";
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-navy">Admin</h2>
      {loadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError} (pastikan SUPABASE_SERVICE_ROLE_KEY sudah diset)
        </p>
      )}
      <AdminPanel initialUsers={users} />
    </div>
  );
}
