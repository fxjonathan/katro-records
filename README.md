# Katro Records — Digital Music Archive

Website arsip publik bernuansa vintage untuk mendokumentasikan koleksi Katro Records. Dibangun dengan React + Vite, Tailwind-ready custom CSS, dan Supabase untuk autentikasi admin, database, serta penyimpanan foto.

## Isi proyek
- Homepage, katalog publik, pencarian, filter kategori, detail koleksi, halaman tentang.
- Halaman admin: login, tambah, edit, hapus koleksi, dan unggah foto.
- `public/catalog.json`: data awal 59 entri berdasarkan folder pada ZIP yang diberikan.
- `public/collections/`: foto pratinjau (satu foto per folder koleksi) yang dikonversi dari HEIC ke JPG.
- `supabase-schema.sql`: skema tabel, RLS, dan bucket gambar.

> Catatan data: nama folder digunakan sebagai judul awal. Kolom artis, tahun, label, kondisi, dan metadata lain yang belum diverifikasi dibiarkan kosong atau ditandai belum diperiksa. Periksa kembali ejaan judul dan artis sebelum publikasi. Foto tambahan dalam tiap folder belum seluruhnya ditampilkan; setiap item memakai satu foto pratinjau awal.

## Jalankan lokal
1. Install Node.js LTS.
2. Ekstrak folder proyek.
3. Jalankan `npm install`.
4. Jalankan `npm run dev`.
5. Buka alamat lokal yang ditampilkan Vite.

## Mengaktifkan admin dan penyimpanan permanen (Supabase)
1. Buat project di https://supabase.com/.
2. Buka SQL Editor dan jalankan seluruh isi `supabase-schema.sql`.
3. Di Authentication > Users, buat akun admin (nonaktifkan public sign-up jika tidak dibutuhkan).
4. Salin UUID akun tersebut, lalu jalankan perintah INSERT admin di bagian akhir file SQL dengan UUID asli.
5. Salin Project URL dan anon/public key dari Project Settings > API.
6. Buat file `.env` di root proyek berdasarkan `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```
7. Restart `npm run dev`. Login admin lewat menu Admin.

Jangan pernah menaruh `service_role` key di frontend atau mengunggah file `.env` ke GitHub.

## Hubungkan data awal ke Supabase
Saat pertama kali diaktifkan, impor data `public/catalog.json` ke tabel `collections` melalui Supabase Table Editor (sesuaikan field `id` agar tidak diimpor jika ingin ID otomatis; kolom `images` menerima JSON array). Foto lokal dapat tetap dipakai untuk katalog statis, atau diunggah ulang melalui halaman admin agar tersimpan di Supabase Storage. Setelah tabel terisi, aplikasi otomatis membaca tabel Supabase.

## Deploy ke Vercel
1. Push folder proyek ke repository GitHub.
2. Import repository di https://vercel.com/new.
3. Framework preset: Vite; Build command `npm run build`; Output directory `dist`.
4. Tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di Vercel > Settings > Environment Variables.
5. Deploy. Setelah mengubah env, lakukan redeploy.

## Catatan keamanan
- Akses publik hanya SELECT koleksi dan melihat foto.
- Operasi INSERT/UPDATE/DELETE dibatasi oleh Row Level Security ke user dengan role `admin` di tabel `profiles`.
- Akun admin dibuat manual di Supabase; jangan menambahkan service-role key ke browser.


## Instalasi dependency jika timeout

Project ini menyertakan `package-lock.json`. Di Windows PowerShell, jalankan dari folder yang berisi `package.json`:

```powershell
npm cache verify
npm ci --fetch-retries=5 --fetch-timeout=300000
```

Jika koneksi masih timeout, coba `npm install --fetch-retries=5 --fetch-timeout=300000` (jangan jalankan keduanya bersamaan). Setelah instalasi selesai:

```powershell
npm run dev
```

Untuk mengecek build produksi:

```powershell
npm run build
```
