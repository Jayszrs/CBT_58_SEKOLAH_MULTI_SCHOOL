# Hasil pemeriksaan fungsi Web App CBT

Lingkup: 15 sekolah pertama (AKUN-01–03). Pengujian alur operasional menggunakan data sementara dijalankan di SCH-001. Seluruh 15 sekolah diuji akses publik, parsing skrip browser, pemilik/palet/sumber deployment, dan koneksi Firebase baca/tulis.

40 tes regresi otomatis lulus. Uji kapasitas banyak siswa serentak dan UAT memakai data peserta asli belum dilakukan.

| Fitur | Hasil | Lingkup | Cara pengujian | Bukti | Batas / catatan |
| --- | --- | --- | --- | --- | --- |
| Halaman siswa tanpa akun Google | Lulus | SCH-001–015 | HTTP publik + browser ukuran HP | 15 URL HTTP 200 dan judul sekolah sesuai | Browser tanpa cookie Google; uji perangkat fisik tetap dapat dilakukan pengguna. |
| Firebase baca/tulis | Lulus | SCH-001–015 | RPC pemilik menulis lalu membaca namespace sekolah | 15 sekolah berhasil WRITE/READ | Rules RTDB tetap tertutup; siswa memakai sesi aplikasi. |
| Tambah/edit/hapus kelas dan mapel | Lulus | SCH-001 | Klik formulir dan tombol di Web App nyata | Data tersimpan, dimuat ulang, diedit, lalu dihapus | Data kelas/mapel QA sudah dibersihkan. |
| Template/import/export kelas | Lulus | SCH-001 | File .xlsx lewat input file dan konfirmasi | Kelas QA tersimpan; template dan ekspor terunduh | Duplikat dan validasi atomik juga diuji otomatis. |
| Tambah/edit/hapus siswa | Lulus | SCH-001 | Klik formulir, refresh, edit, hapus | NISN dengan nol depan tetap utuh | Karakter /, &, apostrof pada nama/kelas/password ikut diuji. |
| Template/import/export siswa | Lulus | SCH-001 | Upload Excel dan unduh hasil | Siswa masuk ke Sheets; kelas baru otomatis dibuat | Data siswa QA sudah dibersihkan. |
| Cetak kartu peserta | Lulus | SCH-001 | Klik Cetak Kartu Peserta | Tab dokumen cetak memuat kedua peserta QA | Pencetakan ke printer fisik tidak dijalankan. |
| Tambah/edit/hapus soal | Lulus | SCH-001 | Form Quill, simpan, edit gambar, hapus terpilih | Soal dan gambar privat tersimpan serta terbaca ulang | Soal/media QA sudah dibersihkan. |
| Import enam tipe soal | Lulus | SCH-001 | Upload Excel dengan PG, PGC, isian, jodoh, BS, sesuai/tidak sesuai | 6 tipe berhasil diimpor dan dijawab di ujian | Template dan ekspor Bank Soal terunduh. |
| Paket soal | Lulus | SCH-001 | Pilih 7 soal, simpan paket, muat ulang, hapus | Paket tersimpan dan terhapus | Race saat data bank soal belum selesai dimuat telah diperbaiki. |
| Pengaturan ujian | Lulus | SCH-001 | Simpan aktif/mapel/nama ujian lalu baca server | Login ujian mengikuti pengaturan tersimpan | Sesudah QA dikembalikan ke ujian tidak aktif. |
| Login siswa dan sesi | Lulus | SCH-001 + uji kode bersama | Login NISN/password dari browser tanpa Google | Siswa manual dan impor berhasil masuk | Sesi terikat sekolah/NISN; token acak diperlukan untuk start/save/submit. |
| Jawab dan navigasi ujian | Lulus | SCH-001 ukuran HP | Fullscreen, berikutnya, ragu, menjodohkan, pilihan, isian | 7 jawaban dari 6 tipe tersimpan | Uji kapasitas banyak siswa serentak belum dilakukan. |
| Autosave dan kirim jawaban | Lulus | SCH-001 | Autosave RPC lalu tombol Selesai Ujian | Firebase menyimpan 7 jawaban dan status Selesai | Bukti hasil akhir diverifikasi terpisah melalui API pemilik. |
| Koreksi nilai | Lulus | SCH-001 | Beri skor kedua isian dan simpan koreksi | Kedua peserta QA mencapai nilai 100 di Sheets dan Firebase | Isian singkat tetap dikoreksi guru; label UI disesuaikan. |
| Ekspor/cetak nilai | Lulus | SCH-001 | Unduh Excel dan cetak per peserta | File .xlsx dan dokumen analisis memuat nilai 100 | Printer fisik tidak dijalankan. |
| Arsip dan pemulihan | Lulus | SCH-001 | Arsipkan lalu kembalikan dan cek NISN/nilai | 2 hasil dipulihkan dengan NISN utuh dan nilai 100 | Dua hasil QA akhirnya disimpan di Arsip_Respon_Jawaban. |
| Ganti logo | Lulus sesuai lingkup | Kode bersama + UI SCH-001 | Pilih file, preview/kompresi; tes penyimpanan server terisolasi | Data logo masuk Script Properties dan Config; invalid/oversize ditolak | Logo sekolah aktif tidak diganti dengan gambar percobaan. |
| Ganti password admin | Lulus sesuai lingkup | Kode bersama + UI SCH-001 | Modal UI + tes login/perubahan/revokasi sesi terisolasi | Pemilik dapat inisialisasi; password berubah membatalkan sesi lama | Kredensial admin aktif tidak diganti saat QA. |
| Keluar/sesi berakhir | Lulus | SCH-001 + tes otomatis | Sesi pemilik berakhir dan dipulihkan lewat login | Aksi admin tanpa sesi ditolak dan kembali ke login | Pemisahan akses Google pemilik dan siswa tetap berlaku. |
| Handler dan sumber aplikasi | Lulus | 15 deployment | 84 handler tersedia; 16 skrip terurai di browser; cocokkan sumber API | Sumber aplikasi/palet/pemilik diverifikasi untuk seluruh 15 sekolah | Alur operasional lengkap memakai data QA dijalankan di SCH-001. |
| Tes regresi otomatis | Lulus | Kode bersama | Node --test, 6 file tes | 40 tes lulus setelah seluruh perbaikan | Bukan hasil uji kapasitas atau UAT data peserta asli. |
| Kelanjutan akun keempat | Proses | AKUN-04 / SCH-016–020 | Firebase dan clasp ranokelvi@gmail.com sudah login | Cloud project cbt-grup-04 dibuat; aktivasi Firebase sedang diperiksa | Tidak dicatat sebagai aplikasi selesai sebelum resource dan runtime terverifikasi. |

Data uji siswa, kelas, mapel, paket, soal, dan sesi Firebase telah dibersihkan. Dua hasil QA bernilai 100 disimpan di Arsip_Respon_Jawaban. Ujian dikembalikan ke tidak aktif. Logo dan kredensial administrator aktif dipertahankan.

Bukti mesin: `SCH001-firebase-live-qa.json`, `public-webapps.json`, `AKUN-01-verification.json`, `AKUN-02-verification.json`, `AKUN-03-verification.json`, dan `resource-runtime-qa.json`.

Monitoring: https://docs.google.com/spreadsheets/d/1ctiUbPqLGSxsRsM79SPRIrwucJ9aTeR0wM9UrjR92Ns/edit#gid=100007

