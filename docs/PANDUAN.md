# Panduan operasional

Panel super admin publik: **https://cbt58-admin-pusat-publik.closedmyna32.chatgpt.site**. Masuk menggunakan username `superadmin` dan password CBT dari file privat. Halaman panel tidak membutuhkan login Google atau ChatGPT. Gunakan alamat ini untuk panel pusat; tautan Apps Script sekolah tetap dipakai untuk aplikasi CBT masing-masing.

Pembagian terbaru: 58 sekolah, maksimal 5 sekolah per akun, 12 grup Firebase (grup terakhir 3 sekolah). Nama dan tiga warna sekolah mengikuti MASTER SEKOLAH serta PALET WARNA. LIST AKUN menyediakan 12 email operasional; pemilik super admin pusat ditetapkan pengguna menjadi dimazunj14@gmail.com. Panel pusat aktif dan akses Kelola sudah lulus uji langsung pada SCH-051â€“058 (8/58); 50 sekolah lainnya menunggu login pemilik. Lihat SUPER-ADMIN.md.

Pilot AKUN-01 dimiliki dimazunj2@gmail.com dan mencakup SCH-001 sampai SCH-005. Spreadsheet, folder Drive, Apps Script dan Web App masing-masing sekolah terpisah. Firebase project dan RTDB dipakai bersama dengan namespace server berbeda.

Buka tab DEPLOY & URL dan pilih Link Web App sekolah. Halaman siswa dapat dibuka tanpa akun Google; siswa masuk menggunakan NISN dan password atau token ujian dari pengawas. Pemilik menyelesaikan izin Google aplikasi, termasuk Firebase dan email, lalu memakai Login Admin â†’ Masuk sebagai pemilik Google. Admin dapat menetapkan password CBT pertama melalui Ganti Password; password Google tidak digunakan sebagai password CBT.

Seluruh 58 Web App memakai akses publik ANYONE_ANONYMOUS dengan eksekusi sebagai pemilik. Akses anonim dan WRITE/READ Firebase lulus pada 58 sekolah; semua 12 RTDB menolak akses langsung publik. Alur CRUD/import/export, ujian enam tipe soal, autosave, submit, koreksi sampai nilai 100, cetak serta arsip dipraktikkan di SCH-001. Data sementara sudah dibersihkan; dua hasil QA ada di arsip. Ujian dikembalikan ke tidak aktif. UAT memakai data peserta asli dan uji kapasitas serentak tetap dicatat terpisah.

ID dan URL aktual ada di config/schools.json dan spreadsheet monitoring. Tab QA FUNGSIONAL dan reports/WEBAPP-FUNCTIONAL-QA.md memuat cara uji dan batasnya, termasuk 52 tes backend dan 2 tes routing portal. reports/central-source-verification.json memeriksa versi publik, sumber, kunci pusat dan akses seluruh 58 sekolah. Pratinjau lokal diberi label; pemeriksaan fungsi menggunakan aplikasi sebenarnya.

Lihat README.md untuk daftar perintah, struktur konfigurasi, autentikasi Firebase dan langkah menambah akun berikutnya. Jangan mencatat password, token OAuth atau private key di kolom progress.

Panel publik pusat: https://cbt58-admin-pusat-publik.closedmyna32.chatgpt.site . Masuk dengan akun superadmin yang sudah disiapkan, lalu klik Kelola pada sekolah tujuan. Sesi sekolah dibatasi selama 30 menit; tiket pembuka hanya berlaku sekali dan hanya untuk sekolah tersebut.

Login untuk sekolah memakai username **admin** dan password persis dari daftar akun yang diberikan pengguna. Seluruh 58 akun sudah dipasang/dicocokkan dan diuji. Link admin dan hasil QA ada pada tab **AKUN ADMIN SEKOLAH** di monitoring. Password disimpan dalam spreadsheet privat yang ditautkan pada tab tersebut; pemiliknya jaelanisurya8@gmail.com dan editor pusat dimazunj14@gmail.com. Bagikan kepada sekolah hanya kredensial sekolah yang bersangkutan. Password admin tidak memerlukan login Google; akun superadmin pusat tetap terpisah.

Untuk latihan, buka Bank Soal â†’ Paket Soal dan cari **Contoh 20 Soal SD â€” Latihan**. Paket memuat 20 soal PG beserta kunci. Jika ingin diujikan, pilih mapel **Contoh Latihan SD** dan paket itu pada Pengaturan Ujian, siapkan siswa/kelas, lalu aktifkan ujian sesuai jadwal. Ujian tidak otomatis diaktifkan saat contoh ditambahkan.

## Akses folder sekolah

Seluruh 58 folder Drive memakai nama sekolah dan dibuka sebagai editor bagi siapa pun dengan tautan, sesuai permintaan 24 November 2026. Nama, ID dan izin `anyone/writer` telah dibaca ulang. Bukti ada pada `reports/public-drive-folder-editing.json`; tautan dan status terbaru ada di LINK SEKOLAH pada monitoring. Daftar password admin tetap berada pada file privat.
