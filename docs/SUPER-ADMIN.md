# Super admin pusat

Status 24 November 2026: **58/58 sekolah aktif** untuk akses pusat dan admin sekolah. Pemilik pusat: **dimazunj14@gmail.com**. Username pusat: **superadmin**.

Buka [Panel Super Admin Publik](https://cbt58-admin-pusat-publik.closedmyna32.chatgpt.site), masuk dengan password pusat, lalu pilih **Kelola** pada sekolah. Halaman tersedia tanpa akun Google atau ChatGPT. Operasi admin tetap memerlukan sesi CBT yang valid; tiket Kelola ditandatangani, terikat sekolah, berlaku singkat dan sekali pakai.

Admin sekolah menggunakan username **admin** dan password persis sesuai daftar dari pengguna. Login, aksi admin, penolakan password salah dan pembatasan reset khusus pusat lulus pada 58 sekolah. Form login/keluar browser diuji pada SCH-001, SCH-029 dan SCH-058. Bukti: `reports/school-admin-login-qa.json` serta `reports/school-admin-credential-delivery.json`.

Monitoring berisi link, username dan status pada **MASTER SEKOLAH** serta **AKUN ADMIN SEKOLAH**. Password disimpan pada daftar Google Sheets privat yang ditautkan di kedua tab; akses tersedia untuk jaelanisurya8@gmail.com dan dimazunj14@gmail.com. Berikan kepada sekolah hanya kredensial milik sekolah tersebut. Password, token OAuth dan kunci penandatanganan tidak disimpan di repository.

Semua 58 spreadsheet dan folder Drive memakai nama sekolah. Akses spreadsheet dan folder sekolah adalah **editor bagi siapa pun dengan tautan**, sesuai permintaan pengguna. ID resource dan isi folder dipertahankan. Pembacaan ulang izin ada di `reports/public-drive-folder-editing.json`; hasil sinkronisasi monitoring ada di `reports/monitoring-status-sync-20261124.json`.

Shortcut `/sekolah/nama-sekolah` membuka aplikasi sekolah dan `/data/nama-sekolah` membuka spreadsheet yang sesuai. Alamat aktual disimpan di `config/public-school-links.json` serta [daftar link sekolah](LINK-58-SEKOLAH.html). Gunakan shortcut tersebut jika URL Google Apps Script menampilkan pesan tidak dapat membuka file.

QA API publik untuk login superadmin, admin sekolah, siswa password/token, autosave, submit dan koreksi nilai lulus pada 58 sekolah. Nilai cocok antara Sheets dan Firebase; data aktif QA telah dibersihkan dan pengaturan asli dipulihkan. Setiap sekolah memiliki paket contoh 20 soal. Bukti: `reports/per-school-functional-qa.json` dan tab **QA FUNGSIONAL**.

UAT memakai peserta asli, uji banyak siswa serentak, konfirmasi MFA serta monitoring kuota tetap dicatat terpisah pada CHECKLIST. SCH-056 mempertahankan pengaturan ujian dan data asli. Pemasangan akses pusat tidak perlu diulang untuk sekolah yang sudah aktif.

Saat memperbarui Apps Script, `scripts/provision-school-pilot.mjs` mempertahankan file kunci privat dari project cloud; cadangan lokal hanya dipakai bila kunci belum tersedia. Jangan menyalin file privat ke repository. Versi deployment publik tidak berubah ketika pemeliharaan izin folder dijalankan.
