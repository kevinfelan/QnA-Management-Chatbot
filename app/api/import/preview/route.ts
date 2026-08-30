import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { listQna } from "@/lib/sheets";

export type ImportPreviewRow = {
  baris: number;
  nama_cluster: string;
  kata_kunci: string;
  pertanyaan_sample: string;
  jawaban: string;
  kategori: string;
  aktif: boolean;
  errors: string[];
  warnings: string[];
};

// Ditahan di 4MB, bukan 5MB: Vercel memotong body request di sekitar 4.5MB,
// jadi file lebih besar bakal gagal di level platform dengan error yang tidak
// terbaca sebelum sempat sampai ke pengecekan di sini.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_ROWS = 500;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  // rich text / formula / hyperlink
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("result" in v) return String(v.result ?? "").trim();
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((t: { text?: string }) => t.text ?? "").join("").trim();
    }
  }
  return String(value).trim();
}

function splitKeywords(s: string): string[] {
  return s.split(",").map((k) => k.trim()).filter(Boolean);
}

// Parse + validasi file Excel, TAPI TIDAK menyimpan apa pun. Hasilnya dipakai
// buat preview di layar supaya bisa dicek dulu sebelum benar-benar masuk ke
// database -- data ini juga dibaca chatbot WhatsApp produksi, jadi import
// mentah tanpa review terlalu berisiko.
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
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "File belum dipilih." },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Ukuran file maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // .xlsx itu sebenarnya file zip. Format .xls lama (BIFF) bukan zip dan
    // memang tidak didukung -- tanpa dicegat di sini, parser cuma melempar
    // "Can't find end of central directory : is this a zip file?" yang tidak
    // ada artinya buat user.
    const buffer = await file.arrayBuffer();
    const sig = new Uint8Array(buffer.slice(0, 4));
    const isZip = sig[0] === 0x50 && sig[1] === 0x4b; // "PK"
    if (!isZip) {
      return NextResponse.json(
        {
          success: false,
          error:
            "File ini bukan format .xlsx. Kalau filenya .xls (Excel lama) atau .csv, buka dulu di Excel lalu Save As \"Excel Workbook (.xlsx)\".",
        },
        { status: 400 }
      );
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    // pakai sheet bernama "QnA" kalau ada, kalau tidak ambil sheet pertama
    const ws =
      wb.worksheets.find((s) => s.name.trim().toLowerCase() === "qna") ??
      wb.worksheets[0];

    if (!ws) {
      return NextResponse.json(
        { success: false, error: "File Excel tidak punya sheet apa pun." },
        { status: 400 }
      );
    }

    // petakan header -> nomor kolom, biar urutan kolom di file bebas
    const headerRow = ws.getRow(1);
    const colOf: Record<string, number> = {};
    headerRow.eachCell((cell, col) => {
      const name = cellText(cell.value).toLowerCase().replace(/\s+/g, "_");
      if (name) colOf[name] = col;
    });

    const required = ["kata_kunci", "jawaban"];
    const missing = required.filter((c) => !(c in colOf));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Kolom wajib tidak ditemukan di baris pertama: ${missing.join(", ")}. Kolom yang terbaca: ${Object.keys(colOf).join(", ") || "(kosong)"}.`,
        },
        { status: 400 }
      );
    }

    const existing = await listQna();
    // kata kunci yang sudah dipakai baris lain -> kalau dobel, skornya seri
    // dan baris yang lebih atas selalu menang, jadi yang baru efektif mati.
    const usedKeywords = new Map<string, string>();
    for (const row of existing) {
      for (const k of splitKeywords(row.kata_kunci)) {
        usedKeywords.set(k.toLowerCase(), row.nama_cluster.trim() || "Umum");
      }
    }

    const get = (row: ExcelJS.Row, key: string) =>
      key in colOf ? cellText(row.getCell(colOf[key]).value) : "";

    const rows: ImportPreviewRow[] = [];
    const seenInFile = new Map<string, number>();

    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const kata_kunci = get(row, "kata_kunci");
      const jawaban = get(row, "jawaban");
      const nama_cluster = get(row, "nama_cluster");
      const pertanyaan_sample = get(row, "pertanyaan_sample");
      const kategori = get(row, "kategori");
      const aktifRaw = get(row, "aktif").toLowerCase();

      // baris benar-benar kosong -> lewati diam-diam
      if (!kata_kunci && !jawaban && !nama_cluster && !pertanyaan_sample && !kategori) {
        continue;
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!kata_kunci) errors.push("kata_kunci wajib diisi");
      if (!jawaban) errors.push("jawaban wajib diisi");

      for (const k of splitKeywords(kata_kunci)) {
        const key = k.toLowerCase();

        if (k.length < 4 && !/^\d/.test(k)) {
          warnings.push(
            `"${k}" cuma ${k.length} huruf — rawan nyangkut di kata lain (mis. "tol" kena "tolong")`
          );
        }
        if (usedKeywords.has(key)) {
          warnings.push(`"${k}" sudah dipakai QnA "${usedKeywords.get(key)}" — yang baru tidak akan pernah menang`);
        }
        const dupRow = seenInFile.get(key);
        if (dupRow) {
          warnings.push(`"${k}" dobel dengan baris ${dupRow} di file ini`);
        } else {
          seenInFile.set(key, i);
        }
      }

      rows.push({
        baris: i,
        nama_cluster,
        kata_kunci,
        pertanyaan_sample,
        jawaban,
        kategori,
        aktif: aktifRaw === "" ? true : !["false", "0", "no", "tidak", "nonaktif"].includes(aktifRaw),
        errors,
        warnings,
      });

      if (rows.length > MAX_ROWS) {
        return NextResponse.json(
          { success: false, error: `Maksimal ${MAX_ROWS} baris per import.` },
          { status: 400 }
        );
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada baris data yang terbaca di file ini." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sheetName: ws.name,
        rows,
        validCount: rows.filter((r) => r.errors.length === 0).length,
        errorCount: rows.filter((r) => r.errors.length > 0).length,
        warningCount: rows.filter((r) => r.warnings.length > 0).length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? `Gagal membaca file: ${err.message}`
            : "Gagal membaca file Excel.",
      },
      { status: 400 }
    );
  }
}
