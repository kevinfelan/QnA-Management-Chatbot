import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { deleteQna, updateQna, type QnaInput } from "@/lib/sheets";

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

  if (!body.kata_kunci || !body.jawaban) {
    return NextResponse.json(
      { success: false, error: "kata_kunci dan jawaban wajib diisi" },
      { status: 400 }
    );
  }

  const input: QnaInput = {
    kata_kunci: body.kata_kunci,
    pertanyaan_sample: body.pertanyaan_sample || "",
    jawaban: body.jawaban,
    kategori: body.kategori || "",
    aktif: body.aktif !== undefined ? Boolean(body.aktif) : true,
    updated_by: session.user.email || "",
    nama_cluster: body.nama_cluster || "",
  };

  try {
    const data = await updateQna(id, input);
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
    await deleteQna(id);
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("tidak ditemukan") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
