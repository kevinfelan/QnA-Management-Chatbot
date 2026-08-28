import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
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
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

export async function uploadFileToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ id: string; url: string }> {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  const fileId = res.data.id;
  if (!fileId) {
    throw new Error("Gagal upload file ke Google Drive.");
  }

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    id: fileId,
    url: `https://drive.google.com/file/d/${fileId}/view`,
  };
}
