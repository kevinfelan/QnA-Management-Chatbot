"use client";

import { useState } from "react";
import type { ProjectRow } from "@/lib/sheets";

export type ProjectFormValues = {
  nama: string;
  keterangan: string;
  foto_url: string;
};

type ProjectFormProps = {
  initialData?: ProjectRow;
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
  onCancel: () => void;
};

export default function ProjectForm({
  initialData,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [nama, setNama] = useState(initialData?.nama ?? "");
  const [keterangan, setKeterangan] = useState(initialData?.keterangan ?? "");
  const [fotoUrl, setFotoUrl] = useState(initialData?.foto_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nama.trim()) {
      setError("Nama project wajib diisi.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        nama: nama.trim(),
        keterangan: keterangan.trim(),
        foto_url: fotoUrl.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nama" className="text-sm font-medium text-ink">
          Nama Project <span className="text-red-600">*</span>
        </label>
        <input
          id="nama"
          type="text"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="keterangan" className="text-sm font-medium text-ink">
          Keterangan
        </label>
        <textarea
          id="keterangan"
          rows={4}
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="foto_url" className="text-sm font-medium text-ink">
          Link Foto (Google Drive)
        </label>
        <textarea
          id="foto_url"
          rows={3}
          value={fotoUrl}
          onChange={(e) => setFotoUrl(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
        <p className="text-xs text-ink/50">
          Pisahkan dengan koma kalau lebih dari satu foto. Pastikan link
          Drive di-share dengan akses &quot;Anyone with the link&quot; supaya
          thumbnail-nya tampil.
        </p>
      </div>

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
