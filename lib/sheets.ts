import { google, sheets_v4 } from "googleapis";

export type QnaRow = {
  id: string;
  kata_kunci: string;
  pertanyaan_sample: string;
  jawaban: string;
  kategori: string;
  aktif: boolean;
  updated_by: string;
  updated_at: string;
};

export type QnaInput = {
  kata_kunci: string;
  pertanyaan_sample: string;
  jawaban: string;
  kategori: string;
  aktif: boolean;
  updated_by: string;
};

const SHEET_NAME = process.env.GOOGLE_QNA_SHEET_NAME || "QnA_Setup";
const SHEET_RANGE_DATA = `${SHEET_NAME}!A2:H`;

let cachedSheetNumericId: number | null = null;

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error("GOOGLE_SHEET_ID belum diset di environment variables.");
  }
  return id;
}

export function getSheetsClient(): sheets_v4.Sheets {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error(
      "GOOGLE_CLIENT_EMAIL atau GOOGLE_PRIVATE_KEY belum diset di environment variables."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function getSheetNumericId(): Promise<number> {
  if (cachedSheetNumericId !== null) {
    return cachedSheetNumericId;
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const sheet = res.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME
  );

  if (!sheet || sheet.properties?.sheetId == null) {
    throw new Error(`Tab "${SHEET_NAME}" tidak ditemukan di spreadsheet.`);
  }

  cachedSheetNumericId = sheet.properties.sheetId;
  return cachedSheetNumericId;
}

function rowToQna(row: string[]): QnaRow | null {
  const [id, kata_kunci, pertanyaan_sample, jawaban, kategori, aktif, updated_by, updated_at] =
    row;

  if (!id) {
    return null;
  }

  return {
    id,
    kata_kunci: kata_kunci || "",
    pertanyaan_sample: pertanyaan_sample || "",
    jawaban: jawaban || "",
    kategori: kategori || "",
    aktif: (aktif || "").toString().trim().toUpperCase() === "TRUE",
    updated_by: updated_by || "",
    updated_at: updated_at || "",
  };
}

export async function listQna(): Promise<QnaRow[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: SHEET_RANGE_DATA,
  });

  const rows = res.data.values || [];

  return rows
    .map((row) => rowToQna(row as string[]))
    .filter((row): row is QnaRow => row !== null);
}

function nextId(existing: QnaRow[]): string {
  let maxNum = 0;
  for (const row of existing) {
    const match = row.id.match(/^qna-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `qna-${maxNum + 1}`;
}

function qnaToRowValues(id: string, data: QnaInput, updatedAt: string): string[] {
  return [
    id,
    data.kata_kunci,
    data.pertanyaan_sample,
    data.jawaban,
    data.kategori,
    data.aktif ? "TRUE" : "FALSE",
    data.updated_by,
    updatedAt,
  ];
}

export async function addQna(data: QnaInput): Promise<QnaRow> {
  const sheets = getSheetsClient();
  const existing = await listQna();
  const id = nextId(existing);
  const updated_at = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: SHEET_RANGE_DATA,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [qnaToRowValues(id, data, updated_at)],
    },
  });

  return {
    id,
    kata_kunci: data.kata_kunci,
    pertanyaan_sample: data.pertanyaan_sample,
    jawaban: data.jawaban,
    kategori: data.kategori,
    aktif: data.aktif,
    updated_by: data.updated_by,
    updated_at,
  };
}

async function findRowIndex(id: string): Promise<{ existing: QnaRow[]; index: number }> {
  const existing = await listQna();
  const index = existing.findIndex((row) => row.id === id);

  if (index === -1) {
    throw new Error(`QnA dengan id "${id}" tidak ditemukan.`);
  }

  return { existing, index };
}

export async function updateQna(id: string, data: QnaInput): Promise<QnaRow> {
  const sheets = getSheetsClient();
  const { index } = await findRowIndex(id);
  const sheetRow = index + 2; // +2: header di row 1, index 0-based
  const updated_at = new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEET_NAME}!A${sheetRow}:H${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [qnaToRowValues(id, data, updated_at)],
    },
  });

  return {
    id,
    kata_kunci: data.kata_kunci,
    pertanyaan_sample: data.pertanyaan_sample,
    jawaban: data.jawaban,
    kategori: data.kategori,
    aktif: data.aktif,
    updated_by: data.updated_by,
    updated_at,
  };
}

export async function deleteQna(id: string): Promise<void> {
  const sheets = getSheetsClient();
  const { index } = await findRowIndex(id);
  const sheetRow = index + 2; // baris asli di sheet (1-based, termasuk header)
  const sheetNumericId = await getSheetNumericId();

  // batchUpdate pakai index 0-based murni (tanpa offset header terpisah),
  // startIndex = sheetRow - 1, endIndex exclusive = sheetRow
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetNumericId,
              dimension: "ROWS",
              startIndex: sheetRow - 1,
              endIndex: sheetRow,
            },
          },
        },
      ],
    },
  });
}
