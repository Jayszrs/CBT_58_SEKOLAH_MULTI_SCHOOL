# Pemeriksaan UI pilot

Lingkup: identitas dan tema halaman login siswa/admin untuk SCH-001 sampai SCH-005. Arah: portal ujian sekolah dengan palet dari spreadsheet; ENERGY 1 / RHYTHM 1 / MOTION 1. Warna utama membedakan sekolah, aksen menandai fokus, background mengikuti PALET WARNA. Tata letak form dipertahankan untuk tugas masuk ujian.

- Hard Gate PASS dalam lingkup perubahan: nama/palet berasal dari spreadsheet; tidak ada statistik, testimoni atau akun siswa rekaan; halaman siswa-admin dan validasi form kosong diuji pada kelima sekolah; tidak ada overflow pada desktop 1280px dan ponsel 390px.
- Purpose Gate PASS dalam lingkup perubahan: primary menandai identitas sekolah/tombol utama, accent menandai fokus, dan background mengambil nilai sumber. Tidak menambah gradien, pola atau glassmorphism. Garis atas kartu mengulang warna identitas sekolah. Bayangan terbatas ke kartu login agar form terpisah dari background.
- Liveliness PASS: satu form sebagai fokus utama, nama sekolah aktual menjadi judul, spacing mengelompokkan label/input/tombol; palet tiap sekolah berbeda sesuai sumber.
- Craftsmanship PASS dalam lingkup perubahan: 58 kombinasi warna tombol lolos rasio kontras 4.5:1; placeholder diperbaiki; fokus keyboard memiliki border dan ring terlihat; navigasi siswa-admin-kembali dan form kosong bekerja. Screenshot desktop/ponsel diperiksa setelah animasi selesai. Reduced motion dihormati.
- Identitas cloud PASS: pemeriksaan API memastikan nama sekolah, tiga warna, ID spreadsheet/folder, URL Firebase, akun pemilik dan akses MYSELF sesuai konfigurasi pada kelima deployment.
- Runtime pemilik SCH-001: pengguna mengonfirmasi halaman login dan dashboard berhasil dibuka.

Pemeriksaan browser lokal memakai sumber HTML aplikasi yang sama dan menampilkan label preview. Panggilan backend pada preview lokal tidak dinyatakan berhasil. Data siswa/guru, ujian, submit, nilai, dan UAT lintas sekolah belum diuji. Status tersebut tetap belum lulus di spreadsheet monitoring.

Validasi skrip: 13 tes lulus, termasuk penolakan akun bukan pemilik, sesi yang berakhir, OAuth Firebase, namespace sekolah, penggunaan ulang spreadsheet dan sintaks sumber.
