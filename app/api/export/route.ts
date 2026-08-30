import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { listProjects, listQna } from "@/lib/sheets";

// Export seluruh data app (QnA + Database Project) jadi satu file Excel
// dua sheet. Header-nya sengaja dibikin sama persis dengan yang diterima
// fitur import, jadi file hasil export bisa langsung diedit lalu di-import
// balik tanpa perlu ubah-ubah kolom.
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
    const [qna, projects] = await Promise.all([listQna(), listProjects()]);

    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    const styleHeader = (ws: ExcelJS.Worksheet) => {
      const header = ws.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2F4B3C" },
      };
      header.alignment = { vertical: "middle" };
      ws.views = [{ state: "frozen", ySplit: 1 }];
    };

    const qnaSheet = wb.addWorksheet("QnA");
    qnaSheet.columns = [
      { header: "nama_cluster", key: "nama_cluster", width: 24 },
      { header: "kata_kunci", key: "kata_kunci", width: 60 },
      { header: "pertanyaan_sample", key: "pertanyaan_sample", width: 36 },
      { header: "jawaban", key: "jawaban", width: 70 },
      { header: "kategori", key: "kategori", width: 18 },
      { header: "aktif", key: "aktif", width: 10 },
    ];
    for (const row of qna) {
      qnaSheet.addRow({
        nama_cluster: row.nama_cluster,
        kata_kunci: row.kata_kunci,
        pertanyaan_sample: row.pertanyaan_sample,
        jawaban: row.jawaban,
        kategori: row.kategori,
        aktif: row.aktif ? "TRUE" : "FALSE",
      });
    }
    styleHeader(qnaSheet);

    const projectSheet = wb.addWorksheet("Database Project");
    projectSheet.columns = [
      { header: "nama_cluster", key: "nama_cluster", width: 24 },
      { header: "daerah", key: "daerah", width: 20 },
      { header: "spec", key: "spec", width: 70 },
      { header: "foto_url", key: "foto_url", width: 50 },
      { header: "video_url", key: "video_url", width: 50 },
    ];
    for (const row of projects) {
      projectSheet.addRow({
        nama_cluster: row.nama_cluster,
        daerah: row.daerah,
        spec: row.spec,
        foto_url: row.foto_url,
        video_url: row.video_url,
      });
    }
    styleHeader(projectSheet);

    const buffer = await wb.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="qna-setup-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
