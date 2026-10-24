# TruthCheck Frontend

Frontend React dengan Vite; request API memakai path relatif `/api`.

## Rute aplikasi

Rute publik: `/`, `/auth/login`, `/auth/register`, dan `/claims/:id`.

Rute yang meminta login: `/submit` (kirim klaim), `/dashboard` (klaim saya), `/evidence` (tambahkan bukti), `/votes` (riwayat suara), dan `/profile` (profil).

## Pengembangan lokal

Jalankan backend dari root dengan `bun run start`, lalu pada terminal kedua:

```powershell
bun run --cwd frontend dev
```

Buka alamat Vite yang ditampilkan di terminal (biasanya `http://localhost:5173`). Proxy Vite meneruskan `/api` ke Express pada `http://localhost:3000`.

## Build

Dari root jalankan `bun run build`. Hasil build ada di `frontend/dist` dan akan disajikan oleh Express bersama endpoint `/api`.
