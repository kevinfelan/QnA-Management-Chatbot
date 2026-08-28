# QnA Setup App — Chatbot Properti WhatsApp

Aplikasi internal (PWA) untuk tim non-teknis mengelola data Tanya-Jawab (QnA)
chatbot WhatsApp properti. Data QnA disimpan di Google Sheets (bukan database
terpisah) karena akan dibaca langsung oleh chatbot WhatsApp yang terpisah dari
app ini. Login memakai Supabase Auth (email + password, user ditambahkan
manual oleh admin, tanpa signup publik).

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS
- Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`)
- Google Sheets API (`googleapis`) — sebagai database QnA satu-satunya
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
   GOOGLE_CLIENT_EMAIL=
   GOOGLE_PRIVATE_KEY=
   GOOGLE_SHEET_ID=
   GOOGLE_QNA_SHEET_NAME=QnA_Setup
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` diambil dari
     project Supabase (Settings → API).
   - `GOOGLE_CLIENT_EMAIL` dan `GOOGLE_PRIVATE_KEY` dari service account Google
     Cloud yang punya akses ke spreadsheet (private key ditulis dengan `\n`
     literal di dalam tanda kutip, akan dikonversi otomatis oleh app).
   - `GOOGLE_SHEET_ID` adalah ID spreadsheet (bagian di URL Google Sheets
     antara `/d/` dan `/edit`).
   - Spreadsheet harus di-share ke email service account (`GOOGLE_CLIENT_EMAIL`)
     dengan akses Editor.

3. Jalankan development server:

   ```bash
   npm run dev
   ```

   Buka [http://localhost:3000](http://localhost:3000).

## Struktur Data Google Sheet

Tab bernama `QnA_Setup`, header di row 1, data mulai row 2:

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

## Deploy

Deploy ke [Vercel](https://vercel.com), set environment variables yang sama
seperti `.env.local` di project settings Vercel.
