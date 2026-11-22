# Panduan operasional

Pembagian terbaru: 58 sekolah, maksimal 5 sekolah per akun, 12 grup Firebase (grup terakhir 3 sekolah). Nama dan tiga warna sekolah mengikuti MASTER SEKOLAH serta PALET WARNA. LIST AKUN menyediakan 9 email; AKUN-10, AKUN-11, AKUN-12 dan admin pusat belum memiliki email.

Pilot AKUN-01 dimiliki dimazunj2@gmail.com dan mencakup SCH-001 sampai SCH-005. Spreadsheet, folder Drive, Apps Script dan Web App masing-masing sekolah terpisah. Firebase project dan RTDB dipakai bersama dengan namespace server berbeda.

Buka tab DEPLOY & URL, pilih Link Web App sekolah, dan gunakan akun Google pemilik. Aplikasi mungkin meminta otorisasi pada pembukaan pertama. Pilih Login Admin lalu Masuk sebagai pemilik Google untuk dashboard. Halaman siswa tersedia, tetapi belum ada data siswa atau paket ujian yang dibuat sebagai bagian provisioning ini.

Preview dibatasi MYSELF. Status Deploy Selesai berarti URL preview pemilik sudah ada dan deployment terverifikasi; bukan persetujuan bahwa ujian produksi sudah siap. Status UAT hanya diubah setelah alur yang bersangkutan benar-benar diuji. Konfirmasi pengguna: halaman login dan dashboard SCH-001 berhasil terbuka.

ID dan URL aktual ada di config/schools.json dan spreadsheet monitoring. Hasil pemeriksaan cloud ada di reports/pilot-verification.json. Pengujian UI lokal tidak melakukan panggilan backend cloud; gambar preview diberi label sesuai batas itu.

Lihat README.md untuk daftar perintah, struktur konfigurasi, autentikasi Firebase dan langkah menambah akun berikutnya. Jangan mencatat password, token OAuth atau private key di kolom progress.
