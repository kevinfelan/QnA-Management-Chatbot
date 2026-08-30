import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { addQnaBulk, type QnaInput } from "@/lib/sheets";

const MAX_ROWS = 500;

// Simpan hasil import ke database. Dipanggil hanya setelah user melihat
// preview dan menekan konfirmasi -- endpoint ini yang benar-benar menulis.
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

  try {
    const body = await request.json();
    const rows = body?.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada baris untuk disimpan." },
        { status: 400 }
      );
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `Maksimal ${MAX_ROWS} baris per import.` },
        { status: 400 }
      );
    }

    const items: QnaInput[] = [];
    for (const [i, row] of rows.entries()) {
      const kata_kunci = String(row?.kata_kunci ?? "").trim();
      const jawaban = String(row?.jawaban ?? "").trim();

      // divalidasi ulang di server -- jangan percaya payload dari client
      if (!kata_kunci || !jawaban) {
        return NextResponse.json(
          {
            success: false,
            error: `Baris ke-${i + 1} tidak valid: kata_kunci dan jawaban wajib diisi.`,
          },
          { status: 400 }
        );
      }

      items.push({
        kata_kunci,
        jawaban,
        pertanyaan_sample: String(row?.pertanyaan_sample ?? "").trim(),
        kategori: String(row?.kategori ?? "").trim(),
        nama_cluster: String(row?.nama_cluster ?? "").trim(),
        aktif: row?.aktif !== undefined ? Boolean(row.aktif) : true,
        updated_by: session.user.email || "",
      });
    }

    const created = await addQnaBulk(items);
    return NextResponse.json({
      success: true,
      data: { imported: created.length, rows: created },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
