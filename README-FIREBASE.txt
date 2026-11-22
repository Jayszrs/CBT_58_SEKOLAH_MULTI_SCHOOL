CBT 58 SEKOLAH - AUTO PROVISION FIREBASE (GRUP)
================================================

PERSYARATAN:
- Node.js sudah terpasang.
- Firebase CLI diinstal: npm install -g firebase-tools
- Firebase CLI login: firebase login
- Pilih akun: firebase login:use dimazunj2@gmail.com
- PENTING: login `clasp` dan login `firebase` adalah dua proses terpisah.

CARA MENJALANKAN:
1. Buka terminal dari ROOT proyek CBT.
2. Pastikan kedua file ini tetap bersama di folder scripts:
   - provision-firebase-group.mjs
   - firebase-group-resources.mjs

SIMULASI:
  node scripts/provision-firebase-group.mjs AKUN-01 --email dimazunj2@gmail.com

EKSEKUSI (menggunakan email yang dipilih untuk semua operasi):
  node scripts/provision-firebase-group.mjs AKUN-01 --email dimazunj2@gmail.com --execute

OTOMATIS TANPA DIALOG KONFIRMASI:
  node scripts/provision-firebase-group.mjs AKUN-01 --email dimazunj2@gmail.com --execute --yes

PENTING:
- Default project ID usulan: cbt-grup-01. ID Firebase harus unik secara global.
- Jika ID sudah dipakai orang lain, pilih ID alternatif yang unik:
  node scripts/provision-firebase-group.mjs AKUN-01 --email dimazunj2@gmail.com --project-id cbt-grup-01-unik2026 --execute
- Script membuat atau melanjutkan 1 Firebase Project per akun/grup.
- Jika Google Cloud project sudah ada tetapi Firebase belum aktif, script
  mengaktifkan Firebase pada project yang sama tanpa membuat project baru.
- Realtime Database default pertama dibuat otomatis di asia-southeast1.
  Gunakan --location jika ingin lokasi lain SEBELUM database pertama dibuat.
- Database default yang sudah ada digunakan kembali di lokasi aktualnya.
- Script menerapkan dan membaca kembali Rules untuk memastikan akses publik tertutup.
- Proses membutuhkan internet, izin Google yang sesuai, dan kuota project.
- TIDAK otomatis membuat kredensial service account, menyimpan private key,
  atau memasang Script Properties di 4 Apps Script. Itu tahap keamanan terpisah.
- URL Realtime Database AKTUAL dan hasil verifikasi disimpan otomatis di:
  firebase-groups/FB-01/provision-result.json (sesuai grup yang dijalankan).
- Jangan bagikan service account JSON, private key, atau password admin.

SETELAH SELESAI:
- Gunakan DATABASE URL yang SAMA untuk SCH001, SCH002, SCH003, SCH004.
- Script Apps Script sudah memakai namespace /schools/SCH001, /schools/SCH002,
  dan seterusnya melalui FirebaseService.js.
- Isi Script Properties untuk tiap sekolah:
  FIREBASE_DATABASE_URL = URL aktual dari Firebase Console
  FIREBASE_CLIENT_EMAIL = email service account project Firebase
  FIREBASE_PRIVATE_KEY = private key disimpan aman dan jangan di repository
- Uji koneksi Firebase dan pemisahan data sebelum deploy CBT publik.

JIKA AKTIVASI FIREBASE GAGAL DENGAN 403:
- Project Google Cloud mungkin sudah terbentuk tetapi belum menjadi Firebase project.
- Pastikan ketentuan Firebase disetujui oleh email yang dipakai script:
  https://console.firebase.google.com/?forceCheckTos=true&authuser=dimazunj2%40gmail.com
- Persetujuan ketentuan harus melalui Firebase Console, tidak dapat lewat CLI/API.
- Script juga memeriksa izin IAM saat aktivasi ditolak.
- Setelah selesai, jalankan ulang perintah yang sama untuk melanjutkan.

VALIDASI SCRIPT:
  node --test scripts/firebase-group-resources.test.mjs
  node scripts/validate.mjs

IMPLEMENTASI:
- Memakai autentikasi dan helper default RTDB dari instalasi firebase-tools lokal/global.
- Diuji dengan Firebase CLI 15.37.0 dan Node.js 22.23.4.
- Tidak mengaktifkan billing atau membuat private key.

HASIL NYATA (2026-11-22):
- AKUN-01 / FB-01: Firebase project cbt-grup-01 aktif.
- Akun: dimazunj2@gmail.com.
- RTDB default: cbt-grup-01-default-rtdb, lokasi asia-southeast1.
- URL: https://cbt-grup-01-default-rtdb.asia-southeast1.firebasedatabase.app
- SCH001, SCH002, SCH003, SCH004 menggunakan URL yang sama.
- Pengisian Script Properties Apps Script tetap perlu dilakukan terpisah.
