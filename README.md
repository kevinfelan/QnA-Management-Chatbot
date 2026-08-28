# QnA Setup App — Chatbot Properti WhatsApp

Aplikasi internal (PWA) untuk tim non-teknis mengelola data Tanya-Jawab (QnA)
chatbot WhatsApp properti. Data QnA dan Database Project disimpan di Google
Sheets (bukan database terpisah) karena akan dibaca langsung oleh chatbot
WhatsApp yang terpisah dari app ini. Login memakai Supabase Auth (email +
password, user ditambahkan lewat modul Admin di dalam app, tanpa signup
publik).

## Modul

- **Dashboard** — ringkasan jumlah kata kunci unik, pertanyaan tersimpan,
  kategori (format jawaban), dan jumlah database properti. Ada search bar
  yang cari lintas data QnA (kata kunci, pertanyaan, jawaban, kategori,
  cluster) dan Database Project (nama cluster, daerah, spec) sekaligus.
- **Input QnA** — CRUD data QnA yang dibaca chatbot WhatsApp, dikelompokkan
  per cluster (accordion, sama seperti Database Project) karena tiap cluster
  bisa punya format jawaban berbeda. Field Kategori berupa dropdown
  autocomplete dari kategori yang sudah pernah dipakai di cluster manapun.
- **Database Project** — daftar project/properti (nama cluster, daerah, spec,
  foto & video). Upload foto/video langsung dari form, otomatis tersimpan ke
  Supabase Storage dan link-nya masuk ke Google Sheets.
- **Test Chat** — simulasi chat ala WhatsApp (in-app, tidak mengirim pesan
  ke mana pun) untuk cek apakah pencocokan kata kunci ke jawaban QnA sudah
  benar sebelum dipakai chatbot asli. Cari kecocokan kata kunci (substring,
  case-insensitive) di antara QnA yang aktif; kalau ada beberapa yang cocok,
  dipilih yang jumlah kata kunci cocoknya paling banyak. Tampilkan info kata
  kunci yang match, cluster, dan kategori di bawah jawaban buat debug.
- **Admin** — undang user baru & atur role (admin/user). Hanya bisa diakses
  oleh user dengan role `admin`.

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS
- Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`) + Supabase Storage
  (foto/video properti)
- Google Sheets API (`googleapis`) — sebagai database QnA & Project
- Deploy target: Vercel

## Setup Lokal

1. Install dependency:

   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env.local`, lalu isi:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   GOOGLE_CLIENT_EMAIL=
   GOOGLE_PRIVATE_KEY=
   GOOGLE_SHEET_ID=
   GOOGLE_QNA_SHEET_NAME=QnA_Setup
   GOOGLE_PROJECTS_SHEET_NAME=Projects
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` diambil dari
     project Supabase (Settings → API).
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → **service_role key**.
     **Rahasia**, jangan pernah dipakai di kode client/browser. Dipakai untuk
     modul Admin (invite user, ubah role) dan upload foto/video (Supabase
     Storage) di modul Database Project — bucket `properti-media` dibuat
     otomatis saat upload pertama kali, sudah public-readable.
   - `GOOGLE_CLIENT_EMAIL` dan `GOOGLE_PRIVATE_KEY` dari service account Google
     Cloud yang punya akses ke spreadsheet (private key ditulis dengan `\n`
     literal di dalam tanda kutip, akan dikonversi otomatis oleh app).
   - `GOOGLE_SHEET_ID` adalah ID spreadsheet (bagian di URL Google Sheets
     antara `/d/` dan `/edit`).
   - Spreadsheet harus di-share ke email service account (`GOOGLE_CLIENT_EMAIL`)
     dengan akses Editor. Tab `Projects` dibuat otomatis oleh app kalau belum
     ada (lewat script satu kali, lihat catatan di bawah) — atau bisa dibuat
     manual dengan header sesuai skema di bawah.

   > **Catatan:** foto/video sempat direncanakan upload ke Google Drive, tapi
   > service account Google tidak punya kuota storage sendiri di akun Gmail
   > personal (limitasi Google, hanya bisa diatasi dengan Shared Drive/Google
   > Workspace atau OAuth login pribadi). Jadi dipindah ke Supabase Storage
   > yang lebih simpel dan tidak kena batasan itu.

3. Jalankan development server:

   ```bash
   npm run dev
   ```

   Buka [http://localhost:3000](http://localhost:3000).

### Bootstrap admin pertama

Role user (`admin` / `user`) disimpan di `app_metadata` Supabase Auth, yang
hanya bisa diubah lewat Admin API (service role key) — user biasa tidak bisa
mengubah role dirinya sendiri. Admin pertama harus di-set manual satu kali,
misalnya lewat Supabase SQL Editor:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
where email = 'email-admin-pertama@contoh.com';
```

Setelah itu, admin tersebut bisa mengundang & mengatur role user lain lewat
modul Admin di dalam app.

## Struktur Data Google Sheet

### Tab `QnA_Setup` (header row 1, data mulai row 2)

| Kolom | Field              | Keterangan                 |
| ----- | ------------------ | --------------------------- |
| A     | id                 | format `qna-<angka>`        |
| B     | kata_kunci         | dipisah koma                |
| C     | pertanyaan_sample  | contoh pertanyaan           |
| D     | jawaban            |                              |
| E     | kategori           |                              |
| F     | aktif              | `TRUE` / `FALSE`            |
| G     | updated_by         | email user yang mengubah    |
| H     | updated_at         | ISO timestamp               |
| I     | nama_cluster       | opsional; kosong = QnA umum, tidak spesifik ke satu cluster |

> Kolom A-H adalah skema asli yang dibaca chatbot WhatsApp — **tidak diubah**.
> Kolom I ditambahkan belakangan khusus untuk grouping di app ini; chatbot
> WhatsApp yang cuma baca A-H tidak terpengaruh.

### Tab `Projects` (header row 1, data mulai row 2)

| Kolom | Field        | Keterangan                                             |
| ----- | ------------ | ------------------------------------------------------- |
| A     | id           | format `proj-<angka>`                                    |
| B     | nama_cluster | nama cluster/project properti                            |
| C     | daerah       | lokasi/daerah                                            |
| D     | spec         | spesifikasi (LT/LB, kamar, harga, dll — free text)        |
| E     | foto_url     | link Supabase Storage, dipisah koma jika lebih dari satu   |
| F     | video_url    | link Supabase Storage, dipisah koma jika lebih dari satu   |
| G     | updated_by   | email user yang mengubah                                 |
| H     | updated_at   | ISO timestamp                                             |

Foto/video di-upload langsung dari form (bukan paste link manual) — app
meng-upload file ke Supabase Storage (bucket `properti-media`, public), lalu
menyimpan public URL-nya ke kolom `foto_url`/`video_url`. Maks 4MB per file
(batas aman ukuran request body di Vercel Serverless Functions) — untuk video
yang lebih besar, kompres/potong dulu sebelum upload.

## Deploy

Deploy ke [Vercel](https://vercel.com), set environment variables yang sama
seperti `.env.local` di project settings Vercel.
