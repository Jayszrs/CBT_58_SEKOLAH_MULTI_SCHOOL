# CBT 58 Sekolah

Konfigurasi sekolah mengikuti spreadsheet monitoring yang diberikan pengguna. Pembagian saat ini adalah **maksimal 5 sekolah per akun**: 12 akun operasional (11 x 5 + 1 x 3) dan satu admin pusat terpisah.

## Sumber dan konfigurasi

- `config/spreadsheet-source.json`: snapshot nama sekolah, palet, tautan yang sudah ada, dan email dari LIST AKUN. Tidak menyimpan password akun Google.
- `config/schools.json` dan `schools.csv`: konfigurasi 58 sekolah beserta ID dan URL aktual.
- `config/accounts.json` dan `accounts.csv`: 12 akun operasional dengan email sesuai LIST AKUN. Pemilik admin pusat ditetapkan pengguna menjadi **dimazunj14@gmail.com**; panel aktif dengan akses Kelola pada 18 sekolah.
- Kode pada spreadsheet berbentuk `SCH-001`; ID internal dan namespace Firebase tetap `SCH001` agar resource lama tidak berpindah.
- `backend/` dan `frontend/`: sumber bersama. `scripts/build.mjs` menghasilkan paket datar `dist/SCH001` sampai `dist/SCH058` dan memperbarui seed inventaris admin pusat.

## Pilot AKUN-01

Akun pemilik: **dimazunj2@gmail.com**. Lima sekolah pertama:

1. SDN KEMAYORAN 01
2. SDN KEMAYORAN 07 PG
3. SDN KEMAYORAN 09 PG
4. SDN KEMAYORAN 13 PG
5. SDN KEMAYORAN 15

Kelima sekolah memiliki spreadsheet, folder media privat, Apps Script, serta deployment Web App berbeda. Resource SCH001 yang sudah ada dipakai kembali. Semua memakai Firebase project `cbt-grup-01` dan RTDB `asia-southeast1` yang sama, dengan path server `schools/SCHxxx`.

URL aktual ada di `config/schools.json`, tab MASTER SEKOLAH dan DEPLOY & URL. `reports/pilot-verification.json` merekam pemeriksaan identitas, palet, kepemilikan resource, dan deployment dari API Google.

## Membuka aplikasi

1. Buka URL Web App sekolah. Halaman siswa tersedia tanpa login Google.
2. Pemilik menyelesaikan otorisasi Google aplikasi, termasuk izin Firebase dan email, sebelum operasional. Siswa tidak memberi izin Google.
3. Halaman siswa menampilkan nama dan palet sekolah. Ujian masih tidak aktif sampai admin menyiapkannya.
4. Pilih **Login Admin**, lalu **Masuk sebagai pemilik Google**. Server memeriksa email Google pemilik dan membuat sesi sementara; tidak menggunakan password Google sebagai password CBT.
5. Login admin dengan password tersedia jika sudah dikonfigurasi. Pemilik Google dapat membuat password admin pertama melalui Ganti Password, dengan password lama kosong jika belum pernah dikonfigurasi.

Lima belas deployment pertama menggunakan `webapp.access=ANYONE_ANONYMOUS` dan `executeAs=USER_DEPLOYING`. Siswa masuk dengan NISN dan password atau token. Server menerbitkan sesi acak yang terikat NISN serta sekolah untuk mulai, menyimpan, dan mengirim ujian. Data sekolah dan kunci jawaban tetap dilindungi di backend.

## Firebase

RTDB menolak baca/tulis publik. Apps Script memakai OAuth pemilik dengan scope `firebase.database` dan izin IAM akun tersebut. Konfigurasi service account lama tetap didukung jika email dan private key sudah disetel di Script Properties, tetapi pilot tidak membuat atau menyimpan private key baru.

URL database, spreadsheet, serta folder diambil dari konfigurasi deployment. Script Properties diisi saat aplikasi dibuka pertama kali; spreadsheet dan folder yang sudah ada digunakan kembali. Palet mencakup primary, accent, background, dan warna teks tombol dengan kontras AA.

## Perintah

```powershell
node scripts/sync-school-config.mjs
node scripts/build.mjs
node scripts/validate.mjs
node scripts/provision-firebase-group.mjs AKUN-01 --email dimazunj2@gmail.com --execute --yes
node scripts/provision-school-pilot.mjs AKUN-01 --execute --parallel
node scripts/verify-school-pilot.mjs AKUN-01
node --test scripts/admin-data.test.mjs scripts/public-session.test.mjs scripts/school-runtime.test.mjs scripts/firebase-group-resources.test.mjs scripts/google-owner-api.test.mjs scripts/webapp-authorization.test.mjs
```

Jalankan provisioning akun berikutnya setelah Firebase dan `clasp` login sesuai email pemilik. Simpan login clasp per email agar akun sebelumnya tetap tersedia:

```powershell
firebase login:add
clasp login --user dimazunj1@gmail.com
node scripts/provision-next-account.mjs AKUN-02 --execute --parallel
```

Pilih `dimazunj1@gmail.com` pada kedua login untuk contoh AKUN-02. Gunakan email masing-masing untuk akun berikutnya. Login biasa clasp sudah cukup untuk provisioning; tidak perlu meminta scope tambahan yang diblokir pada percobaan sebelumnya.

`provision-next-account.mjs` memeriksa kedua login sebelum membuat resource, melanjutkan Firebase/RTDB, mengaktifkan Sheets API, menyinkronkan konfigurasi, membuat deployment dan memverifikasinya. Checkpoint disimpan per akun di `reports/AKUN-XX-provisioning.json`; hasil verifikasi di `reports/AKUN-XX-verification.json`. `google-owner-api.mjs` memilih profil email yang sesuai atau default dengan identitas yang cocok. Opsi tanpa `--execute` hanya menampilkan rencana. Perintah lama `provision-account.mjs` meneruskan ke workflow pembuatan Apps Script setelah Firebase tersedia.

`sync-school-config.mjs` membaca snapshot lokal, bukan mengambil perubahan live secara otomatis. Perbarui snapshot dari spreadsheet sebelum menyinkronkan perubahan nama/email/palet berikutnya. Jangan mengganti email kosong dengan email rekaan.

## Verifikasi dan batas saat ini

- 58 sekolah dan pembagian 5 sekolah/akun telah divalidasi.
- Seluruh 58 deployment publik, versi sumber, nama, palet, URL dan pemilik resource telah diverifikasi lewat API. Rincian ada dalam laporan per akun dan spreadsheet monitoring.
- Halaman publik SCH-001–058 berhasil dibuka tanpa akun Google dan Firebase masing-masing sekolah lulus WRITE/READ. Semua 12 RTDB menolak akses publik langsung (HTTP 401).
- Di SCH001, uji nyata meliputi CRUD kelas/mapel/siswa/soal, impor/ekspor Excel, gambar privat, paket, ujian HP enam tipe soal, autosave, submit, koreksi nilai 100, ekspor/cetak, serta arsip/restore.
- 41 tes regresi lulus, termasuk bank soal/paket besar yang melampaui batas cache. Rincian metode dan batas uji ada di `reports/WEBAPP-FUNCTIONAL-QA.md` dan tab QA FUNGSIONAL spreadsheet monitoring.
- Data QA siswa, kelas, mapel, paket, soal dan sesi Firebase sudah dibersihkan. Dua hasil QA diarsipkan; ujian kembali tidak aktif. Kredensial admin dan logo aktif dipertahankan; penyimpanannya juga diperiksa lewat pengujian terisolasi.
- UAT memakai data peserta asli dan pengujian kapasitas banyak siswa serentak belum dilakukan. Alur lengkap data QA dijalankan di SCH001; sekolah lain menggunakan sumber yang sama dan verifikasi resource masing-masing.

Jangan simpan `.clasprc.json`, private key, token, atau password di repository maupun kolom progress spreadsheet.

## Kelanjutan akses dan super admin (23 November 2026)

Panel pusat publik: **https://cbt58-admin-pusat-publik.closedmyna32.chatgpt.site**. Halaman login tersedia tanpa akun Google/ChatGPT; data tetap memerlukan login CBT `superadmin`. URL ini menggantikan pintu masuk browser Apps Script yang gagal pada pengguna. Backend autentikasi Apps Script tetap dipakai melalui API yang dibatasi operasi dan sesi. Identitas Site, source commit, dan izin publik tercatat di `config/public-admin-site.json`; bukti alur produksi ada di `reports/public-admin-live-qa.json`.

Kelanjutan 23 November 2026: login dimazunj12 dan dimazunj10 telah diverifikasi, sehingga akses pusat dan admin sekolah tersedia pada **SCH-041–058 (18/58)**. Akun admin, password, status dan tautan login untuk 58 sekolah telah dimasukkan ke **MASTER SEKOLAH kolom W–Z** sesuai permintaan pengguna; 40 akun ditandai belum dipasang. Login berikutnya dari bawah adalah umiexchanger@gmail.com (SCH-036–040). Contoh kelas 6 berisi 10 soal Matematika dan 10 Bahasa Indonesia, beserta dua paket, sudah dipasang pada SCH-057 dan SCH-058. [Berkas Excel dan panduan import](docs/contoh-soal/README.md) dapat dipakai sekolah lainnya.

58 spreadsheet sudah bernama sesuai sekolah dan izin editor publik telah dibaca ulang dari Google. Tab **MASTER SEKOLAH**, **DEPLOY & URL**, **LINK SEKOLAH**, serta `docs/LINK-58-SEKOLAH.html` menyediakan shortcut berlabel nama sekolah. Alamat `/data/nama-sekolah` membuka spreadsheet; `/sekolah/nama-sekolah` menyediakan antarmuka sekolah di Sites. Tombol Kelola tetap di Sites. Username `superadmin` dan password pusat dapat digunakan langsung di form sekolah yang aktif. Sebanyak 18 sekolah SCH-041–058 sudah terpasang; 40 lainnya menampilkan keterangan aktivasi pemilik.

Panel super admin, username `superadmin`, sudah dipasang pada **dimazunj14@gmail.com**. Login dan akses admin tersedia pada **SCH-041–058 (18/58)**; verifikasi dicatat di `reports/school-public-backends.json`, `reports/school-public-live-qa.json`, dan `reports/school-admin-login-live-qa.json`. Delapan belas folder tersebut juga terverifikasi publik tanpa login. Sebanyak 40 sekolah lain menunggu login delapan pemilik. Password superadmin tersimpan privat di luar repository. Jalankan `scripts/lanjutkan-super-admin.ps1` untuk login dan melanjutkan pemasangan; halaman login lokal dapat dijalankan dengan `node scripts/owner-login-portal.mjs`. Rincian status dan penyimpanan kredensial ada di [docs/SUPER-ADMIN.md](docs/SUPER-ADMIN.md).
