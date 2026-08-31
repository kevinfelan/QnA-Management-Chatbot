"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { IconArrowRight, IconLayers, IconMessage } from "./icons";

type PreviewRow = {
  baris: number;
  nama_cluster: string;
  kata_kunci: string;
  pertanyaan_sample: string;
  jawaban: string;
  kategori: string;
  aktif: boolean;
  errors: string[];
  warnings: string[];
};

type Preview = {
  sheetName: string;
  rows: PreviewRow[];
  validCount: number;
  errorCount: number;
  warningCount: number;
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

export default function DataTransfer() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState<"app" | "telebot" | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileName, setFileName] = useState("");

  useBodyScrollLock(preview !== null);

  async function handleExport(
    endpoint: string,
    fallbackName: string,
    which: "app" | "telebot"
  ) {
    setExporting(which);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Gagal mengunduh data.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+?)"/);
      const name = match ? match[1] : fallbackName;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNotice(`Berhasil diunduh: ${name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh data.");
    } finally {
      setExporting(null);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // biar file yang sama bisa dipilih lagi
    if (!file) return;

    setReading(true);
    setError(null);
    setNotice(null);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal membaca file.");
      }
      setPreview(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca file.");
    } finally {
      setReading(false);
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    const valid = preview.rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan data.");
      }
      setPreview(null);
      setNotice(`${json.data.imported} QnA berhasil ditambahkan ke database.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  }

  const validRows = preview?.rows.filter((r) => r.errors.length === 0) ?? [];

  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6">
      <h2 className="font-heading text-lg font-semibold text-navy">Export & Import Data</h2>
      <p className="mt-1 text-xs text-ink/60">
        Unduh seluruh data jadi Excel, atau tambah banyak QnA sekaligus dari
        file Excel tanpa input satu-satu.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => handleExport("/api/export", "qna-setup.xlsx", "app")}
          disabled={exporting !== null}
          className="group flex items-center gap-3 rounded-xl border border-navy/10 p-3 text-left transition-colors hover:border-teal/40 hover:bg-teal/5 disabled:opacity-60"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy text-gold">
            <IconLayers className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-semibold text-navy">
              {exporting === "app" ? "Menyiapkan..." : "Export ke Excel"}
            </p>
            <p className="truncate text-xs text-ink/60">
              QnA &amp; Database Project, 2 sheet
            </p>
          </div>
          <IconArrowRight className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-teal" />
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={reading}
          className="group flex items-center gap-3 rounded-xl border border-navy/10 p-3 text-left transition-colors hover:border-teal/40 hover:bg-teal/5 disabled:opacity-60"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal text-white">
            <IconLayers className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-semibold text-navy">
              {reading ? "Membaca file..." : "Import dari Excel"}
            </p>
            <p className="truncate text-xs text-ink/60">Tambah QnA massal</p>
          </div>
          <IconArrowRight className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-teal" />
        </button>
      </div>

      {/* Export khusus buat Knowledge Base chatbot kantor (Cari Properti
          Telebot) -- formatnya beda dari export biasa: satu sheet
          "Knowledge Base" dengan kolom ID/Category/Question/Keywords/
          Items_JSON, dan foto properti ikut jadi gelembung jawaban. */}
      <button
        onClick={() =>
          handleExport(
            "/api/export/telebot",
            "telebot-knowledge-base.xlsx",
            "telebot"
          )
        }
        disabled={exporting !== null}
        className="group mt-3 flex w-full items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3 text-left transition-colors hover:border-gold hover:bg-gold/10 disabled:opacity-60"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-navy">
          <IconMessage className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold text-navy">
            {exporting === "telebot" ? "Menyiapkan..." : "Export untuk Telebot"}
          </p>
          <p className="truncate text-xs text-ink/60">
            Siap unggah ke Knowledge Base chatbot kantor, foto ikut terkirim
          </p>
        </div>
        <IconArrowRight className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-gold" />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="mt-3 text-xs text-ink/50">
        Format file <b>.xlsx</b>. Kolom wajib: <b>kata_kunci</b> dan{" "}
        <b>jawaban</b>. Opsional: nama_cluster, pertanyaan_sample, kategori,
        aktif — urutan kolom bebas. Cara termudah: export dulu, edit filenya,
        lalu import balik.
      </p>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {notice && (
        <p className="mt-3 rounded-md bg-teal/10 px-3 py-2 text-sm text-teal">{notice}</p>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex h-dvh items-center justify-center bg-navy/40 px-4"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-lg">
            <div className="shrink-0 border-b border-navy/10 px-5 py-4">
              <h3 className="font-heading text-lg font-semibold text-navy">
                Cek Dulu Sebelum Disimpan
              </h3>
              <p className="mt-1 text-xs text-ink/60">
                {truncate(fileName, 40)} • sheet &quot;{preview.sheetName}&quot;
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-teal/10 px-2.5 py-1 text-teal">
                  {preview.validCount} siap disimpan
                </span>
                {preview.errorCount > 0 && (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                    {preview.errorCount} dilewati (tidak valid)
                  </span>
                )}
                {preview.warningCount > 0 && (
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[#8D7135]">
                    {preview.warningCount} perlu diperhatikan
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-2.5">
                {preview.rows.map((row) => {
                  const bad = row.errors.length > 0;
                  return (
                    <div
                      key={row.baris}
                      className={`rounded-lg border p-3 text-sm ${
                        bad
                          ? "border-red-200 bg-red-50/60"
                          : row.warnings.length > 0
                            ? "border-gold/40 bg-gold/5"
                            : "border-navy/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-medium text-ink/80">
                          {truncate(row.pertanyaan_sample || row.kata_kunci || "-", 70)}
                        </p>
                        <span className="shrink-0 text-[11px] text-ink/40">
                          baris {row.baris}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-ink/60">
                        {truncate(row.jawaban || "(jawaban kosong)", 110)}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/50">
                        <span>{row.nama_cluster || "Umum"}</span>
                        <span>•</span>
                        <span>{row.kategori || "tanpa kategori"}</span>
                        <span>•</span>
                        <span>{row.aktif ? "Aktif" : "Nonaktif"}</span>
                      </div>

                      {row.errors.map((e) => (
                        <p key={e} className="mt-1.5 text-xs font-medium text-red-700">
                          ✕ {e}
                        </p>
                      ))}
                      {row.warnings.map((w) => (
                        <p key={w} className="mt-1.5 text-xs text-[#8D7135]">
                          ⚠ {w}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-navy/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setPreview(null)}
                disabled={saving}
                className="rounded-md border border-navy/20 px-4 py-2 text-sm font-medium text-ink hover:bg-navy/5 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={saving || validRows.length === 0}
                className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Menyimpan..."
                  : `Simpan ${validRows.length} QnA ke Database`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
