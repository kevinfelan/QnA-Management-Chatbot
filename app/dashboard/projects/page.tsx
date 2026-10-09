import { redirect } from "next/navigation";

// Database Project sudah lebur jadi tab di dalam modul Knowledge Base.
// Alamat lamanya dibiarkan hidup supaya pintasan dan PWA yang sudah
// tersimpan di HP tidak berujung halaman kosong.
export default function ProjectsPage() {
  redirect("/dashboard/qna");
}
