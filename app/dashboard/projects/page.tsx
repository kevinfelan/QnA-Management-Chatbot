import { listProjects } from "@/lib/sheets";
import ProjectTable from "@/components/ProjectTable";

export default async function ProjectsPage() {
  const data = await listProjects();

  return <ProjectTable initialData={data} />;
}
