import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminSupabase } from "@/lib/supabase-admin";
import { isAdmin } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || !isAdmin(session.user)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const email = (body.email || "").trim();
  const role = body.role === "admin" ? "admin" : "user";

  if (!email) {
    return NextResponse.json(
      { success: false, error: "Email wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);

    if (error || !data.user) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal mengirim undangan" },
        { status: 500 }
      );
    }

    const { error: roleError } = await admin.auth.admin.updateUserById(
      data.user.id,
      { app_metadata: { role } }
    );

    if (roleError) {
      return NextResponse.json(
        { success: false, error: roleError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.user.id,
        email: data.user.email,
        role,
        created_at: data.user.created_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
