# TruthCheck: konteks proyek

Aplikasi web verifikasi klaim hoaks berbasis voting komunitas.
Tugas kuliah individu, pembuatnya masih pemula.

## Teknologi
- Back-end: Express.js + SQLite (better-sqlite3), folder `backend/`
- Front-end: ReactJS (Vite), folder `frontend/`
- Semua data dibuat dan disimpan sendiri di SQLite. Jangan pakai API pihak ketiga.

## Konsep
Pengguna mengirim klaim. Pengguna lain menambah bukti dan memberi suara
(benar / salah / menyesatkan). Satu pengguna hanya boleh satu suara per klaim.
Suara disimpan satu baris per suara di tabel `votes`, jumlahnya dihitung saat dibutuhkan.

## Aturan status klaim (dikerjakan di TAHAP 3)
- Kurang dari 5 suara: `belum_terbukti`
- 5 suara atau lebih: status mengikuti suara terbanyak
- Imbang: `belum_terbukti`

## Tahapan kerja
1. Back-end dasar
2. Front-end React
3. Logika penentuan status

## Rule for agent
- Kerjakan HANYA tahap yang disebut di pesan saya. Jangan membuat bagian tahap lain.
- Setelah selesai, berhenti, ringkas file yang dibuat dan cara menjalankannya, lalu tunggu.
- Jangan mengubah file di luar tahap yang sedang dikerjakan tanpa bertanya dulu.
- Tulis kode sederhana dengan komentar singkat dalam bahasa Indonesia.
- Jangan melakukan git commit atau push sendiri.

## Struktur dan CI
- Root punya package.json dengan workspaces ["backend", "frontend"] dan skrip:
  start (jalankan server), build (build frontend), test (bun test)
- Express melayani hasil build frontend (frontend/dist) sebagai file statis dan API di bawah /api,
  sehingga seluruh aplikasi dideploy sebagai satu paket
- Tes memakai bun:test (bukan vitest atau jest), file berakhiran .test.js atau .test.ts
- Rahasia (JWT_SECRET dan sejenisnya) dibaca dari environment variable.
  Jangan di-hardcode, jangan commit .env, sediakan .env.example
- File database SQLite jangan di-commit (.gitignore). Buat tabel dan isi data contoh otomatis
  saat server pertama kali jalan jika database masih kosong