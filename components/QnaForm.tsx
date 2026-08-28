"use client";

import { useState } from "react";
import type { QnaRow } from "@/lib/sheets";

export type QnaFormValues = {
  kata_kunci: string;
  pertanyaan_sample: string;
  jawaban: string;
  kategori: string;
  aktif: boolean;
};

const KATEGORI_OPTIONS = [
  "Umum",
  "Harga",
  "Lokasi",
  "Fasilitas",
  "Pembayaran",
  "Legalitas",
  "Jadwal",
];

type QnaFormProps = {
  initialData?: QnaRow;
  onSubmit: (values: QnaFormValues) => Promise<void> | void;
  onCancel: () => void;
};

export default function QnaForm({ initialData, onSubmit, onCancel }: QnaFormProps) {
  const [kataKunci, setKataKunci] = useState(initialData?.kata_kunci ?? "");
  const [pertanyaanSample, setPertanyaanSample] = useState(
    initialData?.pertanyaan_sample ?? ""
  );
  const [jawaban, setJawaban] = useState(initialData?.jawaban ?? "");
  const [kategori, setKategori] = useState(initialData?.kategori ?? KATEGORI_OPTIONS[0]);
  const [aktif, setAktif] = useState(initialData?.aktif ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!kataKunci.trim() || !jawaban.trim()) {
      setError("Kata kunci dan jawaban wajib diisi.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        kata_kunci: kataKunci.trim(),
        pertanyaan_sample: pertanyaanSample.trim(),
        jawaban: jawaban.trim(),
        kategori,
        aktif,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="kata_kunci" className="text-sm font-medium text-ink">
          Kata Kunci <span className="text-red-600">*</span>
        </label>
        <input
          id="kata_kunci"
          type="text"
          value={kataKunci}
          onChange={(e) => setKataKunci(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
        <p className="text-xs text-ink/50">Pisahkan dengan koma, contoh: harga, cicilan, dp</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pertanyaan_sample" className="text-sm font-medium text-ink">
          Contoh Pertanyaan
        </label>
        <input
          id="pertanyaan_sample"
          type="text"
          value={pertanyaanSample}
          onChange={(e) => setPertanyaanSample(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="jawaban" className="text-sm font-medium text-ink">
          Jawaban <span className="text-red-600">*</span>
        </label>
        <textarea
          id="jawaban"
          rows={4}
          value={jawaban}
          onChange={(e) => setJawaban(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="kategori" className="text-sm font-medium text-ink">
          Kategori
        </label>
        <select
          id="kategori"
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        >
          {KATEGORI_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={aktif}
          onChange={(e) => setAktif(e.target.checked)}
          className="h-4 w-4 rounded border-navy/30 text-teal focus:ring-teal"
        />
        Aktif
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-navy/20 px-4 py-2 text-sm font-medium text-ink hover:bg-navy/5"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}
