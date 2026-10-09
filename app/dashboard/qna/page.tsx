import { listProjects, listQna } from "@/lib/sheets";
import { ambilProjectPk } from "@/lib/pk-moniprop";
import KnowledgeBaseModule from "@/components/KnowledgeBaseModule";

export default async function KnowledgeBasePage() {
  const [qna, projects] = await Promise.all([listQna(), listProjects()]);

  // Dashboard PK dibaca di server: kredensialnya service role, tidak boleh
  // sampai ke browser. Yang dikirim ke client cuma hasilnya.
  const pkIds = [
    ...new Set(
      projects.flatMap((p) =>
        p.pk_id
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    ),
  ];
  const pk = await ambilProjectPk(pkIds);

  return (
    <KnowledgeBaseModule initialQna={qna} initialProjects={projects} pk={pk} />
  );
}
