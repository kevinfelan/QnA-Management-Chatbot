# QnA Setup App — Chatbot Properti WhatsApp

Aplikasi internal (PWA) untuk tim non-teknis mengelola data Tanya-Jawab (QnA)
chatbot WhatsApp properti. Data QnA dan Database Project disimpan di Google
Sheets (bukan database terpisah) karena akan dibaca langsung oleh chatbot
WhatsApp yang terpisah dari app ini. Login memakai Supabase Auth (email +
password, user ditambahkan lewat modul Admin di dalam app, tanpa signup
publik).

## Modul

- **Dashboard** — ringkasan jumlah kata kunci unik, pertanyaan tersimpan, dan
  kategori (format jawaban) yang dipakai.
- **Input QnA** — CRUD data QnA yang dibaca chatbot WhatsApp.
- **Database Project** — daftar project/properti (nama cluster, daerah, spec,
  foto & video). Upload foto/video langsung dari form, otomatis tersimpan ke
  Google Drive dan link-nya masuk ke Google Sheets.
- **Admin** — undang user baru & atur role (admin/user). Hanya bisa diakses
  oleh user dengan role `admin`.

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS
- Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`)
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
   GOOGLE_DRIVE_FOLDER_ID=
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` diambil dari
     project Supabase (Settings → API).
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → **service_role key**.
     **Rahasia**, jangan pernah dipakai di kode client/browser. Dipakai khusus
     untuk modul Admin (invite user, ubah role).
   - `GOOGLE_CLIENT_EMAIL` dan `GOOGLE_PRIVATE_KEY` dari service account Google
     Cloud yang punya akses ke spreadsheet (private key ditulis dengan `\n`
     literal di dalam tanda kutip, akan dikonversi otomatis oleh app).
   - `GOOGLE_SHEET_ID` adalah ID spreadsheet (bagian di URL Google Sheets
     antara `/d/` dan `/edit`).
   - Spreadsheet harus di-share ke email service account (`GOOGLE_CLIENT_EMAIL`)
     dengan akses Editor. Tab `Projects` dibuat otomatis oleh app kalau belum
     ada (lewat script satu kali, lihat catatan di bawah) — atau bisa dibuat
     manual dengan header sesuai skema di bawah.
   - **Google Drive API** harus di-enable juga di project Google Cloud yang
     sama (search "Google Drive API" di Cloud Console → Enable), dipakai
     untuk upload foto/video di modul Database Project.
   - `GOOGLE_DRIVE_FOLDER_ID` — **wajib diisi**, ID folder Google Drive
     tempat foto/video hasil upload disimpan. Service account tidak punya
     kuota storage sendiri di Drive, jadi harus upload ke folder milik akun
     Google asli yang di-share ke service account (akses Editor). Ambil ID
     dari URL folder: `drive.google.com/drive/folders/`**`ID_NYA`**.

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

### Tab `Projects` (header row 1, data mulai row 2)

| Kolom | Field        | Keterangan                                             |
| ----- | ------------ | ------------------------------------------------------- |
| A     | id           | format `proj-<angka>`                                    |
| B     | nama_cluster | nama cluster/project properti                            |
| C     | daerah       | lokasi/daerah                                            |
| D     | spec         | spesifikasi (LT/LB, kamar, harga, dll — free text)        |
| E     | foto_url     | link Google Drive, dipisah koma jika lebih dari satu      |
| F     | video_url    | link Google Drive, dipisah koma jika lebih dari satu      |
| G     | updated_by   | email user yang mengubah                                 |
| H     | updated_at   | ISO timestamp                                             |

Foto/video di-upload langsung dari form (bukan paste link manual) — app
meng-upload file ke Google Drive lewat service account, otomatis set
permission **"Anyone with the link"** supaya thumbnail-nya bisa tampil, lalu
menyimpan link-nya ke kolom `foto_url`/`video_url`. Maks 4MB per file (batas
aman ukuran request body di Vercel Serverless Functions) — untuk video yang
lebih besar, kompres/potong dulu sebelum upload.

## Deploy

Deploy ke [Vercel](https://vercel.com), set environment variables yang sama
seperti `.env.local` di project settings Vercel.
