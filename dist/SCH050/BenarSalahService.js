/**
 * Validasi dan penilaian soal tipe Benar Salah.
 * Format: opsi = 3 pernyataan; kunci_jawaban = ["Benar", "Benar", "Salah"]
 */
function normalizeBenarSalahValue_(value) {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  if (normalized === 'benar' || normalized === 'true') return 'Benar';
  if (normalized === 'salah' || normalized === 'false') return 'Salah';
  return '';
}

function validateBenarSalahQuestion_(dataSoal) {
  if (!dataSoal || dataSoal.tipe !== 'Benar Salah') return { success: true };
  const statements = Array.isArray(dataSoal.opsi) ? dataSoal.opsi : [];
  const rawKeys = Array.isArray(dataSoal.kunci_jawaban) ? dataSoal.kunci_jawaban : [];
  const keys = rawKeys.map(normalizeBenarSalahValue_);
  const statementImages = Array.isArray(dataSoal.opsi_gambar) ? dataSoal.opsi_gambar : [];
  if (statements.length !== 3 || statements.some(function (item, index) {
    const statementText = String(item || '').trim();
    const isImagePlaceholder = /^__CBT_IMAGE_OPTION_\d+__$/.test(statementText);
    const hasText = statementText !== '' && !isImagePlaceholder;
    const hasImage = !!statementImages[index] && typeof statementImages[index] === 'string';
    return !hasText && !hasImage;
  })) {
    return { success: false, message: 'Soal Benar/Salah harus memiliki tepat 3 pernyataan. Setiap pernyataan wajib berisi teks atau gambar.' };
  }
  if (keys.length !== 3 || keys.some(function (item) { return !item; })) {
    return { success: false, message: 'Setiap pernyataan harus memiliki kunci Benar atau Salah.' };
  }
  const trueCount = keys.filter(function (item) { return item === 'Benar'; }).length;
  const falseCount = keys.filter(function (item) { return item === 'Salah'; }).length;
  if (trueCount !== 2 || falseCount !== 1) {
    return { success: false, message: 'Kunci Benar/Salah wajib terdiri dari 2 jawaban Benar dan 1 jawaban Salah.' };
  }
  dataSoal.kunci_jawaban = keys;
  return { success: true };
}

function gradeBenarSalah(jawabanSiswa, kunciJawaban) {
  if (!Array.isArray(jawabanSiswa) || !Array.isArray(kunciJawaban)) return false;
  if (jawabanSiswa.length !== 3 || kunciJawaban.length !== 3) return false;
  for (var i = 0; i < 3; i++) {
    var answer = normalizeBenarSalahValue_(jawabanSiswa[i]);
    var key = normalizeBenarSalahValue_(kunciJawaban[i]);
    if (!answer || !key || answer !== key) return false;
  }
  return true;
}

/** Tipe mandiri: pernyataan Sesuai / Tidak Sesuai. Tidak mengubah aturan Benar/Salah. */
function normalizeSesuaiValue_(value) {
  var str = String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, ' ');
  return str === 'sesuai' ? 'Sesuai' : str === 'tidak sesuai' ? 'Tidak Sesuai' : '';
}
function validateSesuaiQuestion_(data) {
  if (!data || data.tipe !== 'Sesuai Tidak Sesuai') return { success: true };
  var statements = Array.isArray(data.opsi) ? data.opsi : [];
  var keys = Array.isArray(data.kunci_jawaban) ? data.kunci_jawaban.map(normalizeSesuaiValue_) : [];
  var images = Array.isArray(data.opsi_gambar) ? data.opsi_gambar : [];
  if (statements.length !== 3 || statements.some(function(item, i) {
    return !String(item || '').trim() && !images[i];
  })) return { success: false, message: 'Sesuai/Tidak Sesuai memerlukan tepat 3 pernyataan berisi teks atau gambar.' };
  if (keys.length !== 3 || keys.some(function(key) { return !key; }))
    return { success: false, message: 'Semua pernyataan harus memiliki kunci Sesuai atau Tidak Sesuai.' };
  data.kunci_jawaban = keys;
  return { success: true };
}
function gradeSesuaiTidakSesuai(answer, key) {
  if (!Array.isArray(answer) || !Array.isArray(key) || answer.length !== 3 || key.length !== 3) return false;
  return key.every(function(value, i) { return !!normalizeSesuaiValue_(answer[i]) && normalizeSesuaiValue_(answer[i]) === normalizeSesuaiValue_(value); });
}
