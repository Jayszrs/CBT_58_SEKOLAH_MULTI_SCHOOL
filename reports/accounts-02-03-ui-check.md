# Pemeriksaan akun 02 dan 03

Lingkup: konfigurasi dan identitas halaman login sekolah SCH-006 sampai SCH-015. Memakai tata letak sumber yang sama dengan pilot pertama; primary, accent, background dan nama mengikuti spreadsheet. ENERGY 1 / RHYTHM 1 / MOTION 1.

- Hard Gate PASS dalam perubahan identitas/palet: 10 nama berasal dari MASTER SEKOLAH; 20 pemeriksaan viewport desktop/ponsel tidak menemukan overflow; navigasi siswa-admin-kembali berjalan. Tidak menambahkan data siswa atau statistik rekaan.
- Purpose Gate PASS: palet berasal dari PALET WARNA; primary menunjukkan identitas sekolah, accent menandai fokus, background sesuai sumber. Tidak menambah pola atau efek visual baru.
- Liveliness PASS: satu form login sebagai fokus, nama sekolah aktual tampil sebagai judul, warna dan spacing mengikuti tujuan masuk ujian.
- Craftsmanship PASS dalam pengujian lokal: kontras warna tombol untuk 58 sekolah lulus tes; judul sekolah panjang SCH-008 membungkus dengan benar pada lebar 390px. Screenshot diperiksa. Pemeriksaan ini tidak menyatakan backend cloud telah lulus UAT.
- Cloud PASS: 10 deployment, identitas, palet, spreadsheet/folder dan pemilik diperiksa dari API Google; laporan tersimpan per akun.

Runtime belum selesai: pengguna melaporkan error Google ketika membuka SCH-006. Pemeriksaan menggunakan OAuth pemilik mengembalikan halaman `Authorization needed` dan nama aplikasi yang benar. Otorisasi langsung dari Google sedang diminta kepada pengguna. Akun 03 belum diuji pengguna. Status login/ujian/nilai pada spreadsheet tidak dinyatakan lulus.

Validasi sumber/provisioning: 18 tes lulus. Ini mencakup pemilihan login bernama, penolakan email salah, pemulihan pembuatan project, penggunaan kembali resource, isolasi namespace, dan validasi sintaks.
