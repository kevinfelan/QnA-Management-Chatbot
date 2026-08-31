import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { listProjects, listQna } from "@/lib/sheets";
import {
  buildTelebotEntries,
  TELEBOT_SHEET_NAME,
} from "@/lib/telebot-export";

// Export ke format Knowledge Base "Cari Properti Telebot" -- siap langsung
// diunggah lewat tombol "Upload Excel" di panel admin mereka.
// Logika konversinya ada di lib/telebot-export.ts biar bisa diuji terpisah.
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
    const entries = buildTelebotEntries(qna, projects);

    const wb = new ExcelJS.Workbook();
    wb.created = new Date();
    const ws = wb.addWorksheet(TELEBOT_SHEET_NAME);
    ws.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Category", key: "category", width: 18 },
      { header: "Question", key: "question", width: 42 },
      { header: "Keywords", key: "keywords", width: 60 },
      { header: "Items_JSON", key: "items", width: 100 },
    ];

    entries.forEach((entry, i) => {
      ws.addRow({
        id: i + 1,
        category: entry.category,
        question: entry.question,
        keywords: entry.keywords,
        items: JSON.stringify(entry.bubbles),
      });
    });

    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2F4B3C" },
    };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="telebot-knowledge-base-${stamp}.xlsx"`,
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
