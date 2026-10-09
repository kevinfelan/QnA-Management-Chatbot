import { createClient } from "@supabase/supabase-js";

/**
 * Pembaca Dashboard PK Moniprop (tabel `moniprop_pk`, ±363 project).
 *
 * PK adalah sumber kebenaran data properti: disinkron otomatis dari CMS dan
 * website Cari Properti, tiap project paling cepat seminggu sekali. Spec
 * yang diketik tangan di sheet kita terbukti ketinggalan darinya.
 *
 * HANYA UNTUK SISI SERVER. Memakai service role karena kunci anon ditolak
 * tabel ini. Jangan pernah diimpor dari komponen client.
 *
 * Sambungan ini sifatnya sementara: begitu dashboard telesales pindah ke
 * Moniprop, datanya sudah satu rumah dan jembatan ini tidak perlu lagi.
 */

export interface FotoPk {
  url: string;
  thumb: string;
  caption: string | null;
}

export interface TipePk {
  nama: string;
  harga: number | null;
  lt: number | null;
  lb: number | null;
  kt: number | null;
  km: number | null;
  lantai: number | null;
  foto: string | null;
}

export interface FaqPk {
  tanya: string;
  jawab: string;
}

export interface ProjectPk {
  cluster_id: number;
  nama: string;
  developer: string | null;
  district: string | null;
  alamat: string | null;
  latitude: number | null;
  longitude: number | null;
  harga_min: number | null;
  harga_max: number | null;
  kamar_min: number | null;
  kamar_max: number | null;
  cara_bayar: string[] | null;
  promo: string[] | null;
  akses: string | null;
  artikel_lokasi: string | null;
  artikel_utama: string | null;
  artikel_fasilitas: string | null;
  fasilitas: string[] | null;
  foto: FotoPk[] | null;
  tipe: TipePk[] | null;
  faq: FaqPk[] | null;
  url: string | null;
}

const KOLOM =
  "cluster_id,nama,developer,district,alamat,latitude,longitude," +
  "harga_min,harga_max,kamar_min,kamar_max,cara_bayar,promo,akses," +
  "artikel_lokasi,artikel_utama,artikel_fasilitas,fasilitas,foto,tipe,faq,url";

function klien() {
  const url = process.env.MONIPROP_SUPABASE_URL;
  const key = process.env.MONIPROP_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Project PK untuk sekumpulan cluster_id.
 *
 * Mengembalikan daftar kosong kalau kredensialnya belum diset, BUKAN
 * melempar error: app ini harus tetap jalan tanpa sambungan ke Moniprop,
 * cuma tanpa slot yang dibangkitkan dari PK.
 */
export async function ambilProjectPk(clusterIds: number[]): Promise<ProjectPk[]> {
  if (clusterIds.length === 0) return [];
  const db = klien();
  if (!db) return [];

  const { data, error } = await db
    .from("moniprop_pk")
    .select(KOLOM)
    .in("cluster_id", clusterIds);

  if (error) {
    console.error("[pk-moniprop] gagal membaca moniprop_pk:", error.message);
    return [];
  }
  return (data || []) as unknown as ProjectPk[];
}

/** Pencarian project PK berdasarkan nama, untuk memetakan cluster baru. */
export async function cariProjectPk(kata: string, batas = 20): Promise<ProjectPk[]> {
  const db = klien();
  if (!db || !kata.trim()) return [];

  const { data, error } = await db
    .from("moniprop_pk")
    .select(KOLOM)
    .ilike("nama", "%" + kata.trim() + "%")
    .limit(batas);

  if (error) {
    console.error("[pk-moniprop] gagal mencari:", error.message);
    return [];
  }
  return (data || []) as unknown as ProjectPk[];
}
