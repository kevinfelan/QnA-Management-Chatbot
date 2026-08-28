import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { uploadFileToDrive } from "@/lib/drive";

const MAX_SIZE = 4 * 1024 * 1024; // batas aman request body serverless (Vercel)

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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "File tidak ditemukan" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: `File "${file.name}" terlalu besar (maks ${MAX_SIZE / 1024 / 1024}MB)`,
      },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadFileToDrive(
      buffer,
      file.name,
      file.type || "application/octet-stream"
    );
    return NextResponse.json({ success: true, data: uploaded });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal upload file" },
      { status: 500 }
    );
  }
}
