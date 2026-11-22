# CBT 58 Sekolah

Konfigurasi sekolah mengikuti spreadsheet monitoring yang diberikan pengguna. Pembagian saat ini adalah **maksimal 5 sekolah per akun**: 12 akun operasional (11 x 5 + 1 x 3) dan satu admin pusat terpisah.

## Sumber dan konfigurasi

- `config/spreadsheet-source.json`: snapshot nama sekolah, palet, tautan yang sudah ada, dan email dari LIST AKUN. Tidak menyimpan password akun Google.
- `config/schools.json` dan `schools.csv`: konfigurasi 58 sekolah beserta ID dan URL aktual.
- `config/accounts.json` dan `accounts.csv`: 12 slot akun operasional; 9 email tersedia, 3 slot belum berisi email. Email admin pusat juga belum ditentukan.
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

1. Login Google sebagai pemilik sekolah, lalu buka URL Web App sekolah tersebut.
2. Selesaikan otorisasi aplikasi pada pembukaan pertama bila Google memintanya.
3. Halaman siswa menampilkan nama dan palet sekolah. Ujian masih tidak aktif sampai admin menyiapkannya.
4. Pilih **Login Admin**, lalu **Masuk sebagai pemilik Google**. Server memeriksa email Google pemilik dan membuat sesi sementara; tidak menggunakan password Google sebagai password CBT.
5. Login admin dengan password tetap tersedia jika `ADMIN_PASSWORD` sudah dikonfigurasi secara aman.

Deployment pilot menggunakan `webapp.access=MYSELF`, sehingga hanya pemilik Google yang dapat membuka. Ini preview pemilik; akses siswa umum dan UAT ujian/nilai belum dinyatakan selesai.

## Firebase

RTDB menolak baca/tulis publik. Apps Script memakai OAuth pemilik dengan scope `firebase.database` dan izin IAM akun tersebut. Konfigurasi service account lama tetap didukung jika email dan private key sudah disetel di Script Properties, tetapi pilot tidak membuat atau menyimpan private key baru.

URL database, spreadsheet, serta folder diambil dari konfigurasi deployment. Script Properties diisi saat aplikasi dibuka pertama kali; spreadsheet dan folder yang sudah ada digunakan kembali. Palet mencakup primary, accent, background, dan warna teks tombol dengan kontras AA.

## Perintah

```powershell
node scripts/sync-school-config.mjs
node scripts/build.mjs
node scripts/validate.mjs
node scripts/provision-firebase-group.mjs AKUN-01 --email dimazunj2@gmail.com --execute --yes
node scripts/provision-school-pilot.mjs AKUN-01 --execute
node scripts/verify-school-pilot.mjs AKUN-01
node --test scripts/firebase-group-resources.test.mjs scripts/school-runtime.test.mjs
```

Jalankan provisioning akun berikutnya setelah Firebase dan `clasp` login sesuai email pemilik. Simpan login clasp per email agar akun sebelumnya tetap tersedia:

```powershell
firebase login:add
clasp login --user dimazunj1@gmail.com
node scripts/provision-next-account.mjs AKUN-02 --execute
```

Pilih `dimazunj1@gmail.com` pada kedua login untuk contoh AKUN-02. Gunakan email masing-masing untuk akun berikutnya. Login biasa clasp sudah cukup untuk provisioning; tidak perlu meminta scope tambahan yang diblokir pada percobaan sebelumnya.

`provision-next-account.mjs` memeriksa kedua login sebelum membuat resource, melanjutkan Firebase/RTDB, mengaktifkan Sheets API, menyinkronkan konfigurasi, membuat deployment dan memverifikasinya. Checkpoint disimpan per akun di `reports/AKUN-XX-provisioning.json`; hasil verifikasi di `reports/AKUN-XX-verification.json`. `google-owner-api.mjs` memilih profil email yang sesuai atau default dengan identitas yang cocok. Opsi tanpa `--execute` hanya menampilkan rencana. Perintah lama `provision-account.mjs` meneruskan ke workflow pembuatan Apps Script setelah Firebase tersedia.

`sync-school-config.mjs` membaca snapshot lokal, bukan mengambil perubahan live secara otomatis. Perbarui snapshot dari spreadsheet sebelum menyinkronkan perubahan nama/email/palet berikutnya. Jangan mengganti email kosong dengan email rekaan.

## Verifikasi dan batas saat ini

- 58 sekolah dan pembagian 5 sekolah/akun telah divalidasi.
- Lima deployment pilot, nama, palet, URL, dan pemilik resource telah diverifikasi lewat API.
- Pengguna mengonfirmasi halaman login dan dashboard SCH001 berhasil dibuka.
- Tes lokal meliputi sesi pemilik Google, penolakan akun lain, penggunaan OAuth Firebase, namespace sekolah, penggunaan ulang spreadsheet, kontras tombol, dan sintaks sumber.
- Pemeriksaan browser lokal mencakup halaman login lima sekolah pada desktop/ponsel, navigasi siswa-admin, validasi form kosong, dan fokus keyboard. Backend cloud tidak disimulasikan sebagai berhasil.
- UAT siswa/guru, pelaksanaan ujian, autosave, submit, nilai dan isolasi lintas aplikasi masih perlu dijalankan sebelum memperluas akses.

Jangan simpan `.clasprc.json`, private key, token, atau password di repository maupun kolom progress spreadsheet.
