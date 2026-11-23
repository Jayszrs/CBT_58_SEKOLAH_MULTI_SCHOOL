# QA CBT 58 sekolah — akses pusat dan soal contoh

Seluruh 58 sekolah memiliki akses superadmin melalui portal publik dan paket contoh berisi 20 soal PG (total 1.160 soal). Login superadmin melalui tiket sekolah, login siswa password/token, autosave, submit, serta koreksi isian menjadi nilai 100 diuji melalui API HTTPS publik pada tiap sekolah. Nilai diverifikasi terpisah pada Sheets dan Firebase. Data QA aktif dibersihkan; hasil sintetis diberi penanda dan diarsipkan.

UI portal diuji untuk 58 tombol Kelola, pencarian, unduhan daftar link, penolakan password salah, serta pembukaan dashboard SCH-001/029/058. Bank Soal SCH-001 menampilkan 20 contoh di browser. Halaman siswa pada ukuran HP tidak memerlukan Google login.

SCH-056 diuji setelah izin pengguna; TKA Matematika 1 kembali aktif dan 1 siswa/1 hasil asli dipertahankan. UAT peserta asli dan uji banyak siswa serentak belum dilakukan.

| Fitur | Hasil | Lingkup | Cara pengujian | Bukti | Batas / catatan |
|---|---|---|---|---|---|
| Halaman siswa tanpa akun Google | Lulus | SCH-001–058, portal publik | HTTP publik + browser ukuran HP | 58 halaman HTTP 200; identitas sekolah dan formulir login cocok | Browser tanpa cookie Google; uji perangkat fisik tetap dapat dilakukan pengguna. |
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
| Login siswa dan sesi | Lulus | SCH-001–058 | Login NISN/password dari browser tanpa Google | 58 login password/token siswa dan sesi superadmin pusat lulus | Sesi terikat sekolah/NISN; token acak diperlukan untuk start/save/submit. |
| Jawab dan navigasi ujian | Lulus | SCH-001 ukuran HP | Fullscreen, berikutnya, ragu, menjodohkan, pilihan, isian | 7 jawaban dari 6 tipe tersimpan | Uji kapasitas banyak siswa serentak belum dilakukan. |
| Autosave dan kirim jawaban | Lulus | SCH-001–058 | Autosave RPC lalu tombol Selesai Ujian | Autosave dan submit 2 jawaban QA/sekolah tersimpan | Bukti hasil akhir diverifikasi terpisah melalui API pemilik. |
| Koreksi nilai | Lulus | SCH-001–058 | Beri skor kedua isian dan simpan koreksi | 58 hasil QA mencapai 100 setelah koreksi isian, cocok Sheets/Firebase | Isian singkat tetap dikoreksi guru; label UI disesuaikan. |
| Ekspor/cetak nilai | Lulus | SCH-001 | Unduh Excel dan cetak per peserta | File .xlsx dan dokumen analisis memuat nilai 100 | Printer fisik tidak dijalankan. |
| Arsip dan pemulihan | Lulus | SCH-001 | Arsipkan lalu kembalikan dan cek NISN/nilai | 2 hasil dipulihkan dengan NISN utuh dan nilai 100 | Dua hasil QA akhirnya disimpan di Arsip_Respon_Jawaban. |
| Ganti logo | Lulus sesuai lingkup | Kode bersama + UI SCH-001 | Pilih file, preview/kompresi; tes penyimpanan server terisolasi | Data logo masuk Script Properties dan Config; invalid/oversize ditolak | Logo sekolah aktif tidak diganti dengan gambar percobaan. |
| Ganti password admin | Lulus sesuai lingkup | Kode bersama + UI SCH-001 | Modal UI + tes login/perubahan/revokasi sesi terisolasi | Pemilik dapat inisialisasi; password berubah membatalkan sesi lama | Kredensial admin aktif tidak diganti saat QA. |
| Keluar/sesi berakhir | Lulus | SCH-001 + tes otomatis | Sesi pemilik berakhir dan dipulihkan lewat login | Aksi admin tanpa sesi ditolak dan kembali ke login | Pemisahan akses Google pemilik dan siswa tetap berlaku. |
| Handler dan sumber aplikasi | Lulus | 58 deployment | 84 handler tersedia; 16 skrip terurai di browser; cocokkan sumber API | 58 versi publik dan kunci akses pusat cocok konfigurasi; sumber backend/frontend diverifikasi | Alur operasional lengkap memakai data QA dijalankan di SCH-001. |
| Tes regresi otomatis | Lulus | Kode bersama | Node --test: backend dan routing portal | 52 tes backend + 2 tes routing portal lulus | Bukan hasil uji kapasitas atau UAT data peserta asli. |
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
| Super admin publik | Lulus | 58 sekolah | Registry pusat + tiket bertanda tangan; klik Kelola SCH-001/029/058 | Portal menampilkan 58 akses aktif dan 58 tombol Kelola | Autentikasi diperlukan; tiket terikat sekolah, sekali pakai, berlaku singkat. |
| 20 soal contoh per sekolah | Lulus | 58 sekolah | Impor idempoten, baca ulang Bank Soal dan Paket Soal | 58 paket × 20 soal = 1.160 soal; Bank Soal/Paket dibaca ulang | Soal asli dan jadwal ujian dipertahankan. |
| QA login/ujian/nilai per sekolah | Lulus | 58 sekolah | API HTTPS publik: superadmin, password/token siswa, autosave, submit, koreksi | 58/58 sekolah lulus; semua data aktif QA dibersihkan | SCH-056 dipulihkan ke TKA Matematika 1 aktif dan 1 siswa/1 hasil asli; UAT peserta asli/beban belum dilakukan. |
