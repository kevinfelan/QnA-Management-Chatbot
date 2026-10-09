import { listProjects, listQna } from "@/lib/sheets";
import QnaTable from "@/components/QnaTable";

export default async function QnaPage() {
  // Penanda utama/cross-sell hanya hidup di sheet Projects. Layar QnA
  // meminjamnya supaya susunan dropdownnya persis sama dengan layar
  // Database Project -- kalau ditaruh dua tempat, cepat atau lambat
  // keduanya berbeda.
  const [data, projects] = await Promise.all([listQna(), listProjects()]);

  const utamaClusters = projects
    .filter((p) => p.tipe === "utama")
    .map((p) => p.nama_cluster);

  return <QnaTable initialData={data} utamaClusters={utamaClusters} />;
}
