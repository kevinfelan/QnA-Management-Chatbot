import { listQna } from "@/lib/sheets";
import TestChat from "@/components/TestChat";

export default async function TestChatPage() {
  const data = await listQna();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-navy">Test Chat</h2>
        <p className="text-sm text-ink/60">
          Simulasikan percakapan customer untuk mengecek apakah data QnA
          tersambung dengan kata kunci yang benar.
        </p>
      </div>
      <TestChat initialData={data} />
    </div>
  );
}
