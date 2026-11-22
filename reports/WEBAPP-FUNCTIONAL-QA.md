# Pemeriksaan fungsi CBT — 58 sekolah

58 deployment publik, akses HTTP anonim, source/palet/pemilik dan Firebase WRITE/READ terverifikasi. Semua 12 RTDB menolak akses publik langsung. Alur operasional lengkap dengan data QA dijalankan di SCH-001 memakai sumber yang sama; UAT peserta asli dan uji kapasitas serentak belum dilakukan.

| Fitur | Hasil | Lingkup | Cara pengujian | Bukti | Batas / catatan |
|---|---|---|---|---|---|
| Halaman siswa tanpa akun Google | Lulus | SCH-001–058 | HTTP publik + browser ukuran HP | 58 URL HTTP 200 dan judul sekolah sesuai | Browser tanpa cookie Google; uji perangkat fisik tetap dapat dilakukan pengguna. |
| Firebase baca/tulis | Lulus | SCH-001–058 | RPC pemilik menulis lalu membaca namespace sekolah | 58 sekolah berhasil WRITE/READ | Rules RTDB tetap tertutup; siswa memakai sesi aplikasi. |
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
| Handler dan sumber aplikasi | Lulus | 58 deployment | 84 handler tersedia; 16 skrip terurai di browser; cocokkan sumber API | 58 versi publik, palet dan pemilik cocok; skrip runtime terurai tanpa galat | Alur operasional lengkap memakai data QA dijalankan di SCH-001. |
| Tes regresi otomatis | Lulus | Kode bersama | Node --test, 6 file tes | 41 tes lulus setelah seluruh perbaikan | Bukan hasil uji kapasitas atau UAT data peserta asli. |
| Akun keempat | Lulus resource/runtime | AKUN-04 / SCH-016–020 | Verifikasi API, akses publik dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Akun kelima | Lulus resource/runtime | AKUN-05 / SCH-021–025 | Verifikasi API, akses publik dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Akun keenam | Lulus resource/runtime | AKUN-06 / SCH-026–030 | Verifikasi API, akses publik dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Bank soal/paket besar | Lulus tes kode | Kode bersama | 250 soal dan 250 paket; cache opsional menolak payload besar | Daftar tetap terbaca meskipun CacheService gagal menyimpan | Perbaikan diterapkan ke deployment; uji kapasitas serentak belum dilakukan. |
| Akun ketujuh | Lulus resource/runtime | AKUN-07 / SCH-031–035 | Verifikasi API, akses publik dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Akun kedelapan | Lulus resource/runtime | AKUN-08 / SCH-036–040 | Verifikasi API, runtime aplikasi dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Akun kesembilan | Lulus resource/runtime | AKUN-09 / SCH-041–045 | Verifikasi versi publik API, HTTP anonim dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Akun kesepuluh | Lulus resource/runtime | AKUN-10 / SCH-046–050 | Verifikasi versi publik API, runtime aplikasi dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Akun kesebelas | Lulus resource/runtime | AKUN-11 / SCH-051–055 | Verifikasi versi publik API, runtime aplikasi dan WRITE/READ | Kelima aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
| Akun kedua belas | Lulus resource/runtime | AKUN-12 / SCH-056–058 | Verifikasi versi publik API, HTTP anonim dan WRITE/READ | Ketiga aplikasi dan database terverifikasi | UAT peserta asli per sekolah belum dilakukan. |
