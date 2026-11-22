# Panduan operasional

Pembagian terbaru: 58 sekolah, maksimal 5 sekolah per akun, 12 grup Firebase (grup terakhir 3 sekolah). Nama dan tiga warna sekolah mengikuti MASTER SEKOLAH serta PALET WARNA. LIST AKUN menyediakan 9 email; AKUN-10, AKUN-11, AKUN-12 dan admin pusat belum memiliki email.

Pilot AKUN-01 dimiliki dimazunj2@gmail.com dan mencakup SCH-001 sampai SCH-005. Spreadsheet, folder Drive, Apps Script dan Web App masing-masing sekolah terpisah. Firebase project dan RTDB dipakai bersama dengan namespace server berbeda.

Buka tab DEPLOY & URL dan pilih Link Web App sekolah. Halaman siswa dapat dibuka tanpa akun Google; siswa masuk menggunakan NISN dan password atau token ujian dari pengawas. Pemilik menyelesaikan izin Google aplikasi, termasuk Firebase dan email, lalu memakai Login Admin → Masuk sebagai pemilik Google. Admin dapat menetapkan password CBT pertama melalui Ganti Password; password Google tidak digunakan sebagai password CBT.

SCH-001–015 memakai akses publik ANYONE_ANONYMOUS dengan eksekusi sebagai pemilik. Halaman publik dan koneksi database 15 sekolah telah diuji. Alur CRUD/import/export, ujian enam tipe soal, autosave, submit, koreksi sampai nilai 100, cetak serta arsip dipraktikkan di SCH-001. Data sementara sudah dibersihkan; dua hasil QA ada di arsip. Ujian dikembalikan ke tidak aktif. UAT memakai data peserta asli dan uji kapasitas serentak tetap dicatat terpisah.

ID dan URL aktual ada di config/schools.json dan spreadsheet monitoring. Tab QA FUNGSIONAL dan reports/WEBAPP-FUNCTIONAL-QA.md memuat cara uji dan batasnya, termasuk 40 tes regresi otomatis. Reports/AKUN-XX-verification.json mencocokkan identitas, sumber, palet, pemilik dan deployment Google. Pratinjau lokal diberi label; pemeriksaan fungsi menggunakan Web App sebenarnya.

Lihat README.md untuk daftar perintah, struktur konfigurasi, autentikasi Firebase dan langkah menambah akun berikutnya. Jangan mencatat password, token OAuth atau private key di kolom progress.
