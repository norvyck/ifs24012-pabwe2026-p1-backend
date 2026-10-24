# Backend TruthCheck

Backend menggunakan Express.js dan SQLite bawaan Bun (`bun:sqlite`). Tabel dan data contoh dibuat otomatis saat server pertama kali membuka database kosong.

## Menjalankan

1. Dari root proyek, salin `.env.example` menjadi `.env`.
2. Ganti `JWT_SECRET` dengan secret acak yang panjang.
3. Jalankan `bun install`, lalu `bun run start`.
4. API berjalan pada `http://localhost:3000`.

Untuk validasi proyek, jalankan `bun run build` dan `bun run test` dari root.

Akun contoh: `ani@example.com` dan `budi@example.com`, keduanya memakai password `password123`.

## Endpoint

Semua request body menggunakan JSON. Endpoint bertanda login memerlukan header `Authorization: Bearer <token>`.

| Method | Endpoint | Akses | Keterangan |
| --- | --- | --- | --- |
| GET | `/api/health` | Publik | Pemeriksaan server |
| POST | `/api/auth/register` | Publik | Body: `name`, `email`, `password` (minimal 8 karakter) |
| POST | `/api/auth/login` | Publik | Body: `email`, `password` |
| GET | `/api/claims` | Publik | Daftar klaim |
| GET | `/api/claims/:id` | Publik | Detail klaim, bukti, dan jumlah suara |
| GET | `/api/me/claims` | Login | Daftar klaim milik pengguna yang sedang login |
| GET | `/api/me/votes` | Login | Riwayat suara pengguna yang sedang login |
| POST | `/api/claims` | Login | Body: `title`, `description`, opsional `source_url` |
| PUT | `/api/claims/:id` | Pemilik klaim | Mengubah klaim |
| DELETE | `/api/claims/:id` | Pemilik klaim | Menghapus klaim |
| POST | `/api/claims/:id/evidence` | Login | Body: `content`, opsional `source_url` |
| POST | `/api/claims/:id/votes` | Login | Body: `vote_type` (`benar`, `salah`, atau `menyesatkan`) |

Password disimpan dalam bentuk hash. Database membatasi satu suara per pengguna untuk setiap klaim. Respons daftar dan detail klaim menyertakan jumlah suara per pilihan, total suara, dan status yang dihitung dari tabel `votes`: kurang dari 5 suara atau jumlah tertinggi yang imbang menghasilkan `belum_terbukti`; selain itu status mengikuti pilihan dengan suara terbanyak. Status tidak disimpan ke database.

Jika folder `frontend/dist` tersedia, Express menyajikan isinya sebagai file statis.
