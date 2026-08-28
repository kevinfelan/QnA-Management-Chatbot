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

export type ProjectRow = {
  id: string;
  nama_cluster: string;
  daerah: string;
  spec: string;
  foto_url: string;
  video_url: string;
  updated_by: string;
  updated_at: string;
};

export type ProjectInput = {
  nama_cluster: string;
  daerah: string;
  spec: string;
  foto_url: string;
  video_url: string;
  updated_by: string;
};

const QNA_SHEET_NAME = process.env.GOOGLE_QNA_SHEET_NAME || "QnA_Setup";
const QNA_RANGE_DATA = `${QNA_SHEET_NAME}!A2:H`;

const PROJECTS_SHEET_NAME = process.env.GOOGLE_PROJECTS_SHEET_NAME || "Projects";
const PROJECTS_RANGE_DATA = `${PROJECTS_SHEET_NAME}!A2:H`;

const numericSheetIdCache = new Map<string, number>();

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

async function getSheetNumericId(sheetName: string): Promise<number> {
  if (numericSheetIdCache.has(sheetName)) {
    return numericSheetIdCache.get(sheetName)!;
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });

  const sheet = res.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (!sheet || sheet.properties?.sheetId == null) {
    throw new Error(`Tab "${sheetName}" tidak ditemukan di spreadsheet.`);
  }

  numericSheetIdCache.set(sheetName, sheet.properties.sheetId);
  return sheet.properties.sheetId;
}

async function deleteRow(sheetName: string, sheetRow: number): Promise<void> {
  const sheets = getSheetsClient();
  const sheetNumericId = await getSheetNumericId(sheetName);

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

// ---------- QnA ----------

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
    range: QNA_RANGE_DATA,
  });

  const rows = res.data.values || [];

  return rows
    .map((row) => rowToQna(row as string[]))
    .filter((row): row is QnaRow => row !== null);
}

function nextId(prefix: string, existingIds: string[]): string {
  let maxNum = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existingIds) {
    const match = id.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `${prefix}-${maxNum + 1}`;
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
  const id = nextId("qna", existing.map((row) => row.id));
  const updated_at = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: QNA_RANGE_DATA,
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

async function findQnaRowIndex(id: string): Promise<number> {
  const existing = await listQna();
  const index = existing.findIndex((row) => row.id === id);

  if (index === -1) {
    throw new Error(`QnA dengan id "${id}" tidak ditemukan.`);
  }

  return index;
}

export async function updateQna(id: string, data: QnaInput): Promise<QnaRow> {
  const sheets = getSheetsClient();
  const index = await findQnaRowIndex(id);
  const sheetRow = index + 2; // +2: header di row 1, index 0-based
  const updated_at = new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${QNA_SHEET_NAME}!A${sheetRow}:H${sheetRow}`,
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
  const index = await findQnaRowIndex(id);
  await deleteRow(QNA_SHEET_NAME, index + 2);
}

// ---------- Projects ----------

function rowToProject(row: string[]): ProjectRow | null {
  const [id, nama_cluster, daerah, spec, foto_url, video_url, updated_by, updated_at] = row;

  if (!id) {
    return null;
  }

  return {
    id,
    nama_cluster: nama_cluster || "",
    daerah: daerah || "",
    spec: spec || "",
    foto_url: foto_url || "",
    video_url: video_url || "",
    updated_by: updated_by || "",
    updated_at: updated_at || "",
  };
}

export async function listProjects(): Promise<ProjectRow[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: PROJECTS_RANGE_DATA,
  });

  const rows = res.data.values || [];

  return rows
    .map((row) => rowToProject(row as string[]))
    .filter((row): row is ProjectRow => row !== null);
}

function projectToRowValues(id: string, data: ProjectInput, updatedAt: string): string[] {
  return [
    id,
    data.nama_cluster,
    data.daerah,
    data.spec,
    data.foto_url,
    data.video_url,
    data.updated_by,
    updatedAt,
  ];
}

export async function addProject(data: ProjectInput): Promise<ProjectRow> {
  const sheets = getSheetsClient();
  const existing = await listProjects();
  const id = nextId("proj", existing.map((row) => row.id));
  const updated_at = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: PROJECTS_RANGE_DATA,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [projectToRowValues(id, data, updated_at)],
    },
  });

  return {
    id,
    nama_cluster: data.nama_cluster,
    daerah: data.daerah,
    spec: data.spec,
    foto_url: data.foto_url,
    video_url: data.video_url,
    updated_by: data.updated_by,
    updated_at,
  };
}

async function findProjectRowIndex(id: string): Promise<number> {
  const existing = await listProjects();
  const index = existing.findIndex((row) => row.id === id);

  if (index === -1) {
    throw new Error(`Project dengan id "${id}" tidak ditemukan.`);
  }

  return index;
}

export async function updateProject(id: string, data: ProjectInput): Promise<ProjectRow> {
  const sheets = getSheetsClient();
  const index = await findProjectRowIndex(id);
  const sheetRow = index + 2;
  const updated_at = new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${PROJECTS_SHEET_NAME}!A${sheetRow}:H${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [projectToRowValues(id, data, updated_at)],
    },
  });

  return {
    id,
    nama_cluster: data.nama_cluster,
    daerah: data.daerah,
    spec: data.spec,
    foto_url: data.foto_url,
    video_url: data.video_url,
    updated_by: data.updated_by,
    updated_at,
  };
}

export async function deleteProject(id: string): Promise<void> {
  const index = await findProjectRowIndex(id);
  await deleteRow(PROJECTS_SHEET_NAME, index + 2);
}
