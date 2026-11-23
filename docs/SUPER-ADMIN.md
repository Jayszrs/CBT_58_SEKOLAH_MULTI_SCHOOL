# Super admin pusat

Pemilik yang ditetapkan pengguna: **dimazunj14@gmail.com**. Username panel: **superadmin**.

Masuk menggunakan username `superadmin` di [Panel Super Admin Publik](https://cbt58-admin-pusat-publik.closedmyna32.chatgpt.site), kemudian pilih sekolah dan tekan **Kelola**. Halaman login panel tersedia tanpa login Google atau ChatGPT. Password berada di file privat yang sama. Pada sekolah yang sudah aktif, form **Portal Guru / Admin** juga menerima username `superadmin` dan password pusat. Verifikasi dilakukan server pusat; password admin sekolah tetap berlaku untuk akun admin sekolah.

Tombol Kelola yang belum aktif berarti akses pusat pada sekolah itu masih memerlukan login pemilik. Contohnya SCH-016, SDN KEBON KOSONG 13, dimiliki ranokelvi@gmail.com dan belum termasuk delapan sekolah yang terpasang.

Jika muncul halaman Google Drive dengan pesan **Sorry, unable to open the file at this time**, perhatikan apakah URL berubah menjadi `/macros/u/3/s/…`. Halaman itu muncul sebelum aplikasi dijalankan dan dapat berkaitan dengan sesi beberapa akun Google. Google mendokumentasikan bahwa Apps Script tidak mendukung multi-login secara andal: [Issues with multiple Google Accounts](https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts).

Gunakan alamat Sites di atas untuk panel dan shortcut `/sekolah/nama-sekolah` untuk aplikasi sekolah. Halaman sekolah dan tombol Kelola tetap berada di Sites; panggilan data diteruskan ke backend Apps Script. Ini menghindari halaman Google Drive yang dilaporkan gagal bahkan dalam Incognito. Shortcut `/data/nama-sekolah` membuka spreadsheet yang sesuai. ID spreadsheet dan deployment Google tetap dipertahankan.

**Insiden akses 23 November 2026:** pengguna melaporkan URL Apps Script asli dan pemulihan tetap gagal di browser biasa serta Incognito. Penyebab pada browser pengguna belum dapat dipastikan. Sebagai jalur operasional, panel dipublikasikan di alamat Sites di atas sehingga halaman login tidak melewati routing akun Google `/u/3/`. Sites dikonfigurasi sebagai **public**, dan hasil baca ulang kebijakan serta pengujian browser anonim membuktikan halaman, login, penolakan password salah, daftar 58 sekolah, Kelola dan logout berhasil di alamat produksi. Bukti ada di `config/public-admin-site.json` dan `reports/public-admin-live-qa.json`. Konfirmasi langsung pengguna dicatat terpisah dari pengujian otomatis.

Antarmuka publik dan proxy memakai `gateway/worker-template.mjs`; source Site lengkap berada di repository Sites terpisah dengan commit yang tercatat pada `config/public-admin-site.json`. `scripts/build-public-admin.mjs` dapat membuat ulang checkout lokal yang diabaikan Git utama di `public-admin/`. Proxy mengirim operasi pusat ke `admin-central/CentralApi.js` dan operasi sekolah ke `backend/SchoolPublicApi.js` melalui HTTPS. Keduanya membatasi daftar fungsi; operasi admin dan siswa tetap memeriksa sesi. Login langsung superadmin menukar password melalui backend pusat dengan tiket sekali pakai yang terikat sekolah. Penyimpanan sesi dan jawaban browser diberi awalan ID sekolah agar tidak bercampur pada satu domain. Tidak ada password, kunci sekolah, atau OAuth token yang ditanam dalam antarmuka publik maupun repository Site.

Status pada 23 November 2026: **panel dan akun superadmin telah dipasang** pada dimazunj14@gmail.com. Halaman panel pusat telah diverifikasi publik dan izin Google pertamanya sudah selesai. Akses Kelola serta folder publik telah dipasang dan diuji pada **SCH-051–058 (8/58)**. Sebanyak 50 sekolah lain masih memerlukan login 10 pemilik. URL aktual tersedia di `config/central-admin.json` dan spreadsheet monitoring, tab RINGKASAN.

## Yang sudah diselesaikan langsung

- Nama 58 spreadsheet telah diubah persis sesuai nama sekolah, dengan ID dan URL tetap.
- Pembacaan ulang metadata Google memastikan nama cocok dan izin `anyone/writer` tetap aktif untuk seluruh spreadsheet. Bukti: `reports/school-access-and-names.json`.
- Semua 58 halaman web app berhasil dibuka anonim. Bukti: `reports/public-webapps.json`.
- Tab **MASTER SEKOLAH**, **DEPLOY & URL**, dan **LINK SEKOLAH** menampilkan tautan berlabel nama sekolah. Kolom ID spreadsheet dan Apps Script dipertahankan. Shortcut publik tersedia pada `config/public-school-links.json`; sekolah yang belum aktif menampilkan keterangan menunggu pemilik.
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

Uji produksi melalui browser anonim lulus untuk panel publik, password salah, daftar 58 sekolah, tombol Kelola yang tetap di Sites, serta logout (`reports/public-admin-live-qa.json`). Login `superadmin` langsung di delapan halaman sekolah dan pemeriksaan sesi admin lulus (`reports/school-public-live-qa.json`). Statistik, kelas, reload sesi, penolakan admin tanpa sesi, dan logout diuji pada SCH-051 serta SCH-056 (`reports/public-school-functional-qa.json`). Sebanyak 638 tautan bernama sekolah dan ID resource yang tetap sama telah dibaca ulang dari spreadsheet (`reports/monitoring-shortcuts-verified.json`); tampilan MASTER SEKOLAH juga diperiksa lewat browser anonim. Keseluruhan 58 akses Kelola belum dinyatakan selesai.

Setelah deployment, verifikasi langsung login benar dan salah, satu tombol Kelola pada tiap sekolah, fungsi admin yang diperlukan, akses folder tanpa login, serta URL yang tetap sama. Perbarui status monitoring dan laporan hanya setelah verifikasi tersebut. Jika proses terputus, jalankan pemasang kembali: checkpoint privat menyimpan kunci, versi terpasang, dan kredensial awal yang sama.

Untuk akun tambahan, pemasangan kunci pusat perlu diikuti sinkronisasi sumber sekolah dengan `scripts/provision-school-pilot.mjs AKUN-XX --execute --parallel`, dijalankan bergantian per akun. Ini memasang transport publik dan metadata koneksi pusat terbaru sambil mempertahankan kunci privat serta URL deployment. Verifikasi backend dan handoff sebelum menambahkan sekolah ke daftar aktif Sites; jangan menandai 50 sekolah menunggu sebagai aktif hanya karena shortcut-nya sudah dibuat. Bangun ulang dan terbitkan versi Sites, lalu verifikasi login serta perbarui status monitoring.

Delapan folder Drive SCH-051–058 sudah dibuka oleh sesi ini dan berhasil dibaca tanpa login. Sebanyak 50 folder lain masih mengarah ke halaman masuk Google. Bukti ada pada `reports/public-drive-folders.json`. Akun Google Drive konektor adalah jaelanisurya8@gmail.com dan tidak memiliki akses pemilik pada folder privat; perubahan folder dan deployment menggunakan login resmi pemilik melalui clasp.
