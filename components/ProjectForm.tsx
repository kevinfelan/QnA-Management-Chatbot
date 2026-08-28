"use client";

import { useState } from "react";
import type { ProjectRow } from "@/lib/sheets";

export type ProjectFormValues = {
  nama_cluster: string;
  daerah: string;
  spec: string;
  foto_url: string;
  video_url: string;
};

type ProjectFormProps = {
  initialData?: ProjectRow;
  existingClusters?: string[];
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
  onCancel: () => void;
};

const MAX_FILE_SIZE = 4 * 1024 * 1024;

function parseUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || `Gagal upload ${file.name}`);
  }

  return json.data.url as string;
}

export default function ProjectForm({
  initialData,
  existingClusters = [],
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [namaCluster, setNamaCluster] = useState(initialData?.nama_cluster ?? "");
  const [daerah, setDaerah] = useState(initialData?.daerah ?? "");
  const [spec, setSpec] = useState(initialData?.spec ?? "");
  const [fotoUrls, setFotoUrls] = useState<string[]>(
    parseUrls(initialData?.foto_url ?? "")
  );
  const [videoUrls, setVideoUrls] = useState<string[]>(
    parseUrls(initialData?.video_url ?? "")
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);

  async function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "foto" | "video"
  ) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(
          `${file.name} terlalu besar (maks ${MAX_FILE_SIZE / 1024 / 1024}MB).`
        );
        continue;
      }

      setUploadingLabel(
        `Mengupload ${kind === "foto" ? "foto" : "video"}: ${file.name}...`
      );

      try {
        const url = await uploadFile(file);
        if (kind === "foto") {
          setFotoUrls((prev) => [...prev, url]);
        } else {
          setVideoUrls((prev) => [...prev, url]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal upload file");
      }
    }

    setUploadingLabel(null);
  }

  function removeUrl(kind: "foto" | "video", url: string) {
    if (kind === "foto") {
      setFotoUrls((prev) => prev.filter((u) => u !== url));
    } else {
      setVideoUrls((prev) => prev.filter((u) => u !== url));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!namaCluster.trim()) {
      setError("Nama cluster wajib diisi.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        nama_cluster: namaCluster.trim(),
        daerah: daerah.trim(),
        spec: spec.trim(),
        foto_url: fotoUrls.join(", "),
        video_url: videoUrls.join(", "),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nama_cluster" className="text-sm font-medium text-ink">
          Nama Cluster <span className="text-red-600">*</span>
        </label>
        <input
          id="nama_cluster"
          type="text"
          list="cluster-suggestions"
          value={namaCluster}
          onChange={(e) => setNamaCluster(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
        {existingClusters.length > 0 && (
          <datalist id="cluster-suggestions">
            {existingClusters.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        )}
        <p className="text-xs text-ink/50">
          Pakai nama yang sama persis untuk mengelompokkan beberapa properti
          dalam satu cluster.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="daerah" className="text-sm font-medium text-ink">
          Daerah
        </label>
        <input
          id="daerah"
          type="text"
          value={daerah}
          onChange={(e) => setDaerah(e.target.value)}
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="spec" className="text-sm font-medium text-ink">
          Spesifikasi
        </label>
        <textarea
          id="spec"
          rows={4}
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder="Contoh: LT 90 / LB 60, 2KT 1KM, harga mulai 500jt"
          className="rounded-md border border-navy/20 px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink">Foto</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e, "foto")}
          className="text-sm"
        />
        {fotoUrls.length > 0 && (
          <ul className="flex flex-col gap-1">
            {fotoUrls.map((url) => (
              <li
                key={url}
                className="flex items-center justify-between rounded-md bg-navy/5 px-2 py-1 text-xs"
              >
                <span className="truncate">{url}</span>
                <button
                  type="button"
                  onClick={() => removeUrl("foto", url)}
                  className="ml-2 shrink-0 text-red-600 hover:underline"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink">Video</label>
        <input
          type="file"
          accept="video/*"
          multiple
          onChange={(e) => handleFileSelect(e, "video")}
          className="text-sm"
        />
        {videoUrls.length > 0 && (
          <ul className="flex flex-col gap-1">
            {videoUrls.map((url) => (
              <li
                key={url}
                className="flex items-center justify-between rounded-md bg-navy/5 px-2 py-1 text-xs"
              >
                <span className="truncate">{url}</span>
                <button
                  type="button"
                  onClick={() => removeUrl("video", url)}
                  className="ml-2 shrink-0 text-red-600 hover:underline"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink/50">
          Maks {MAX_FILE_SIZE / 1024 / 1024}MB per file foto/video.
        </p>
      </div>

      {uploadingLabel && (
        <p className="rounded-md bg-teal/10 px-3 py-2 text-sm text-teal">
          {uploadingLabel}
        </p>
      )}
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
          disabled={submitting || !!uploadingLabel}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}
