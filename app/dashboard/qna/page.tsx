import { listQna } from "@/lib/sheets";
import QnaTable from "@/components/QnaTable";

export default async function QnaPage() {
  const data = await listQna();

  return <QnaTable initialData={data} />;
}
