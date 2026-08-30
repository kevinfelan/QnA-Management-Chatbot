import { listProjects, listQna } from "@/lib/sheets";
import TestChat from "@/components/TestChat";

export default async function TestChatPage() {
  const [qna, projects] = await Promise.all([listQna(), listProjects()]);

  return (
    <div className="flex flex-col gap-4">
      {/* disembunyikan di HP biar kotak chat bisa penuh dari atas; desktop
          masih ada ruang jadi tetap ditampilkan buat konteks. */}
      <div className="hidden sm:block">
        <h2 className="font-heading text-lg font-semibold text-navy">Test Chat</h2>
        <p className="text-sm text-ink/60">
          Simulasikan percakapan customer untuk mengecek apakah data QnA dan
          foto/video Database Project tersambung dengan benar.
        </p>
      </div>
      <TestChat initialQna={qna} initialProjects={projects} />
    </div>
  );
}
