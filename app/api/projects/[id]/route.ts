import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { deleteProject, updateProject, type ProjectInput } from "@/lib/sheets";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (!body.nama) {
    return NextResponse.json(
      { success: false, error: "nama wajib diisi" },
      { status: 400 }
    );
  }

  const input: ProjectInput = {
    nama: body.nama,
    keterangan: body.keterangan || "",
    foto_url: body.foto_url || "",
    updated_by: session.user.email || "",
  };

  try {
    const data = await updateProject(id, input);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("tidak ditemukan") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await deleteProject(id);
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("tidak ditemukan") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
