import { listProjects, listQna } from "@/lib/sheets";
import KnowledgeBaseModule from "@/components/KnowledgeBaseModule";

export default async function KnowledgeBasePage() {
  const [qna, projects] = await Promise.all([listQna(), listProjects()]);

  return <KnowledgeBaseModule initialQna={qna} initialProjects={projects} />;
}
