# CBT 58 Sekolah — multi-school scaffold (berdasarkan CBT_UPGRADE_STAGING_AMAN.zip)

## Struktur project
- `backend/` — 12 file GAS `.js` asli, diperbaiki untuk namespace sekolah + setup resource; file tambahan `SchoolDeploymentConfig.js` dibuat otomatis pada masing-masing output.
- `frontend/` — 28 HTML asli + `SchoolTheme.html` untuk tema dinamis.
- `config/schools.json` dan `schools.csv` — 58 sekolah, 15 kelompok Firebase, 58 warna unik, kolom URL yang masih kosong.
- `config/accounts.json` — 15 akun operasional (maks 4 sekolah) dan 1 admin pusat.
- `scripts/build.mjs` — membuat `dist/SCH001/` sampai `dist/SCH058/`, rata sesuai format clasp (flat files).
- `scripts/provision-account.mjs` — membuat/mengunggah 4/2 Apps Script per akun melalui clasp, dengan konfirmasi interaktif. **Tidak mengaktifkan Web App publik.**
- `scripts/record-links.mjs` — mencatat URL Spreadsheet/Drive/Web App yang benar setelah dibuat, bukan URL palsu.

## Cara tercepat di Windows (PowerShell)
1. Instal Node.js v20+ dan `npm install -g @google/clasp`.
2. Aktifkan Apps Script API: https://script.google.com/home/usersettings
3. Ubah `config/schools.json` untuk nama sekolah yang sebenarnya dan `config/accounts.json` untuk alamat email akun (bukan password), lalu `node scripts/build.mjs`.
4. Login akun pertama: `clasp login`. Verifikasi bahwa browser memakai akun yang tepat.
5. Jalankan dari root project: `node scripts/provision-account.mjs AKUN-01 --execute`. Ketik konfirmasi akun yang diminta.
6. Buka setiap project Apps Script, isi **Script Properties**: `FIREBASE_DATABASE_URL`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Isi `ADMIN_RESET_TEMP_PASSWORD` minimal 14 karakter dan jalankan `resetAdminPasswordOnce` agar tidak ada password default.
7. Jalankan `setupSchoolResources` pada editor Apps Script dari akun pemilik. Script membuat **Spreadsheet + folder Drive unik** dan mengeluarkan `spreadsheet_url`, `drive_folder_url` di Execution Log. Fitur ini idempotent karena menyimpan ID di Script Properties.
8. Salin link aktual ke manifest dengan: `node scripts/record-links.mjs SCH001 --spreadsheet "https://docs.google.com/spreadsheets/d/REAL_ID/edit" --drive "https://drive.google.com/drive/folders/REAL_ID"`.
9. Uji login, autosave, submit, output Google Sheets, Firebase `schools/SCH001`, dan penolakan akses antarsekolah.
10. Jika sudah melewati audit autentikasi, deploy Web App via editor Apps Script. Tempel URL melalui `node scripts/record-links.mjs SCH001 --webapp "https://script.google.com/macros/s/REAL_DEPLOYMENT_ID/exec"`.
11. Ulangi akun 2–15 dengan `clasp login --no-localhost` atau login interaktif sesuai kebutuhan, **selalu cek akun aktif**, lalu buat master inventaris admin pusat dengan mengimpor `config/schools.csv` ke Google Sheets admin pusat.

## Ketentuan backend / frontend
Google Apps Script TIDAK mengizinkan subfolder sebagai penamaan project. Struktur backend/frontend di sini hanya untuk development; `scripts/build.mjs` menghasilkan file `.js`/`.html` datar di tiap `dist/SCHxxx` agar `clasp push` berhasil.

## Firebase
- Satu Firebase Project per akun operasional sebagai *rencana*, bukan batas resmi kuota Firebase.
- Keempat aplikasi dalam grup menggunakan `FIREBASE_DATABASE_URL` yang sama dan aksesnya di-path `schools/SCHxxx/...`. Tiap Apps Script menyimpan kredensialnya sendiri.
- Folder logis saja **tidak cukup sebagai otorisasi**, karena service account bisa mempunyai akses ke database satu grup penuh. Audit IAM, sesi, role, dan pembatasan operasional sebelum produksi.

## Link Spreadsheet
**Saat file ini dibuat, 58 link Google Sheets aktual BELUM ada.** Link baru terbentuk ketika `setupSchoolResources()` benar-benar dijalankan setelah setiap project dikloning ke akun yang tepat. Jangan isi URL rekaan. Script `record-links.mjs` membantu pencatatan.

## Keamanan — belum untuk produksi ujian
- Password recovery bersama yang hard-coded dari source lama telah dinonaktifkan.
- Masih ada audit penting yang perlu dikerjakan: otentikasi sesi siswa, otorisasi API POST, penyimpanan password siswa, ketahanan submit/autosave terhadap kegagalan Firebase/Sheets, pembatasan laju, beban ujian serentak.
- Jangan deploy `ANYONE_ANONYMOUS` sebelum semua jalur backend yang bisa dipanggil publik aman.
- Jangan menyimpan JSON service account, `.clasprc.json`, private key, password di proyek ini.
- Akun admin pusat sebaiknya punya akses view-only ke inventaris; jangan gunakan superadmin lintas sekolah dengan password bersama.

## Admin pusat (AKUN-16)
- Upload folder `dist/ADMIN_PUSAT` dengan `clasp create-script --title "CBT-ADMIN-PUSAT" --type standalone` lalu `clasp push` sambil login akun admin.
- Jalankan fungsi `setupCentralRegistry()` di editor, otorisasi akses Google Sheets. Fungsi membuat satu Google Sheet admin dengan 58 baris inventaris.
- Link Google Sheet admin muncul di Execution Log sebagai `LINK_ADMIN_PUSAT=...`. Link per sekolah TIDAK dibuat otomatis dari akun admin: harus dibuat di akun pemilik sekolah terlebih dahulu, lalu diisi ke kolom registry admin.
- Script setup aman diulang; tidak menimpa link yang sudah diisi.

Security: default appsscript.json menggunakan webapp.access=MYSELF untuk test; ubah kebijakan akses hanya setelah audit autentikasi dan deployment siap untuk siswa.
