import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { addQna, listQna, type QnaInput } from "@/lib/sheets";

export async function GET() {
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
    const data = await listQna();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
  };

  try {
    const data = await addQna(input);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
