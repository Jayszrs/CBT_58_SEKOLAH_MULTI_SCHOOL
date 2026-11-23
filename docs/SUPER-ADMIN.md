# Super admin pusat

Pemilik yang ditetapkan pengguna: **dimazunj14@gmail.com**. Username panel: **superadmin**.

Masuk menggunakan akun tersebut di [Panel Super Admin pusat](https://script.google.com/macros/s/AKfycbw_dH95FP7iCBiE4X1DZ_HLiOLCEmDsEshutMFmaQElz_U-zaDTVY7mFzfaAY_Ha0qZOw/exec), kemudian pilih sekolah dan tekan **Kelola**. Form **Portal Guru / Admin** pada masing-masing sekolah menggunakan password admin sekolah. Username `superadmin` pada form sekolah akan diarahkan ke petunjuk panel pusat; password pusat tidak dikirim oleh form tersebut.

Tombol Kelola yang belum aktif berarti akses pusat pada sekolah itu masih memerlukan login pemilik. Contohnya SCH-016, SDN KEBON KOSONG 13, dimiliki ranokelvi@gmail.com dan belum termasuk delapan sekolah yang terpasang.

Jika muncul halaman Google Drive dengan pesan **Sorry, unable to open the file at this time**, perhatikan apakah URL berubah menjadi `/macros/u/3/s/…`. Halaman itu muncul sebelum aplikasi dijalankan dan dapat berkaitan dengan sesi beberapa akun Google. Google mendokumentasikan bahwa Apps Script tidak mendukung multi-login secara andal: [Issues with multiple Google Accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).

Untuk memisahkan sesi, buka jendela Incognito dengan **Ctrl+Shift+N**, tempel URL panel pusat yang berbentuk `/macros/s/…/exec`, lalu masuk menggunakan akun CBT `superadmin`. Panel menggunakan akses publik sehingga login Google tidak diperlukan untuk login password ini. Alternatif penggunaan rutin adalah profil Chrome terpisah. Jangan menyalin kembali URL yang sudah mengandung `/u/3/` dari tab yang gagal.

Status pada 23 November 2026: **panel dan akun superadmin telah dipasang** pada dimazunj14@gmail.com. Halaman panel pusat telah diverifikasi publik dan izin Google pertamanya sudah selesai. Akses Kelola serta folder publik telah dipasang dan diuji pada **SCH-051–058 (8/58)**. Sebanyak 50 sekolah lain masih memerlukan login 10 pemilik. URL aktual tersedia di `config/central-admin.json` dan spreadsheet monitoring, tab RINGKASAN.

## Yang sudah diselesaikan langsung

- Nama 58 spreadsheet telah diubah persis sesuai nama sekolah, dengan ID dan URL tetap.
- Pembacaan ulang metadata Google memastikan nama cocok dan izin `anyone/writer` tetap aktif untuk seluruh spreadsheet. Bukti: `reports/school-access-and-names.json`.
- Semua 58 halaman web app berhasil dibuka anonim. Bukti: `reports/public-webapps.json`.
- Spreadsheet monitoring memiliki tab **LINK SEKOLAH** berisi 58 pasangan tautan berlabel nama sekolah, tautan folder, akun pemilik, serta status akses.
- Akun admin pusat pada tab **AKUN FIREBASE** telah dicatat sebagai dimazunj14@gmail.com, status **Proses**.

Daftar yang dapat dibuka di laptop: [LINK-58-SEKOLAH.html](LINK-58-SEKOLAH.html). Versi CSV tersedia di direktori yang sama.

## Memasang dan melanjutkan

Node.js dan Google clasp telah dipasang pada profil lokal pengguna. Jalankan dari PowerShell di direktori proyek:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\lanjutkan-super-admin.ps1
```

Halaman login lokal juga tersedia dengan menjalankan `node scripts/owner-login-portal.mjs`, lalu membuka `http://127.0.0.1:8768`. Halaman itu menunjukkan identitas yang sudah cocok dan menyediakan tautan login Google untuk akun lain. Setelah login akun yang tersedia, jalankan pemasang dengan `--execute --available-accounts`. Akun dimazunj2 untuk SCH-001–005 belum tersedia karena pengguna menemui verifikasi 2FA; gunakan alur verifikasi akun Google tersebut atau akses yang diberikan pemilik.

Login yang sudah benar akan dipakai kembali. Untuk akun yang belum tersedia, helper menampilkan tautan Google dengan pemilihan akun eksplisit. Buka tautan itu, pilih email yang ditampilkan, lalu selesaikan izin. Akun pertama adalah dimazunj14@gmail.com, disusul 11 pemilik lainnya. Kata sandi Google tidak dimasukkan ke terminal atau dikirim melalui chat. Helper hanya menyimpan kredensial jika email Google yang kembali benar.

Pemasang kemudian:

1. Memastikan folder Drive benar-benar dimiliki akun sekolah, membuka folder media sebagai pembaca publik lewat tautan, dan membaca ulang izinnya.
2. Menyimpan salinan sumber Apps Script sebelum perubahan di direktori privat di luar repository.
3. Menambahkan akses super admin ke 58 sekolah dan memperbarui deployment yang sama. URL lama dipertahankan.
4. Membuat proyek panel pusat pada dimazunj14@gmail.com dan mencatat URL yang dikembalikan Google ke `config/central-admin.json`.

Aktifkan Google Apps Script API jika akun menolak akses pada `https://script.google.com/home/usersettings`. Setiap akun pemilik tetap harus memberi izin Google yang diminta oleh aplikasinya. Panel pusat memakai scope spreadsheet dan identitas email; sekolah memakai scope yang sudah dikonfigurasi sebelumnya.

Kredensial awal sudah disimpan di `%LOCALAPPDATA%\CBT58-Private\AKSES-SUPER-ADMIN.txt`, di luar repository. Masuk ke panel menggunakan username **superadmin** dan password awal tersebut, lalu gunakan **Ganti password**. Login pemilik Google tersedia bila Google memberikan identitas pengguna aktif. Pemasangan bertahap dapat dilanjutkan dengan `node scripts/provision-central-admin.mjs --execute --available-accounts`; kunci dan password awal yang sudah ada dipakai kembali.

Panel menampilkan 58 sekolah; pencarian dan filter akun; tautan web app, spreadsheet dan Drive; unduh CSV; serta tombol **Kelola** untuk dashboard admin tiap sekolah. Jumlah akses terpasang diambil dari kunci sekolah yang sudah benar-benar dideploy. Kunci dan hash password hanya berada pada sumber server Apps Script dan checkpoint privat, tidak dikirim ke halaman publik.

Sesi panel dan sesi sekolah berlaku 30 menit. Tiket perpindahan berlaku 60 detik, terikat sekolah, bertanda tangan, dan hanya boleh digunakan sekali. Ganti password panel mencabut sesi panel lama. Sesi sekolah yang sudah diterbitkan tetap berlaku sampai kedaluwarsa; rotasi kunci sekolah mencabut sesi sekolah.

## Verifikasi dan kelanjutan

`reports/central-admin-provisioning.json` membedakan kebutuhan login, pemasangan deployment, dan penerimaan aplikasi langsung. Sumber lokal lulus uji keamanan tiket/sesi dan uji UI desktop/HP dengan RPC simulasi. Uji UI lokal **bukan** bukti deployment atau login Google berhasil.

Uji langsung juga telah lulus melalui browser anonim: login password, penolakan password salah, daftar 58 sekolah, keluar dari panel, dan handoff bertanda tangan sampai panggilan admin `ping` di SCH-051–058. Bukti: `reports/central-admin-live-qa.json`, mode `LIVE_GOOGLE_RPC_ANONYMOUS_BROWSER`. Keseluruhan 58 akses Kelola belum dinyatakan selesai.

Setelah deployment, verifikasi langsung login benar dan salah, satu tombol Kelola pada tiap sekolah, fungsi admin yang diperlukan, akses folder tanpa login, serta URL yang tetap sama. Perbarui status monitoring dan laporan hanya setelah verifikasi tersebut. Jika proses terputus, jalankan pemasang kembali: checkpoint privat menyimpan kunci, versi terpasang, dan kredensial awal yang sama.

Delapan folder Drive SCH-051–058 sudah dibuka oleh sesi ini dan berhasil dibaca tanpa login. Sebanyak 50 folder lain masih mengarah ke halaman masuk Google. Bukti ada pada `reports/public-drive-folders.json`. Akun Google Drive konektor adalah jaelanisurya8@gmail.com dan tidak memiliki akses pemilik pada folder privat; perubahan folder dan deployment menggunakan login resmi pemilik melalui clasp.
