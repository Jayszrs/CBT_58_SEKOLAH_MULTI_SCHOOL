
function ensureBankSoalExtraColumns_() {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Bank_Soal');
  if (!sheet) throw new Error('Sheet Bank_Soal tidak ditemukan.');
  const requiredHeaders = ['Petunjuk', 'Teks Pendukung', 'Opsi Gambar'];
  for (let i = 0; i < requiredHeaders.length; i++) {
    const column = 9 + i;
    if (!sheet.getRange(1, column).getValue()) {
      sheet.getRange(1, column).setValue(requiredHeaders[i]).setFontWeight('bold');
    }
  }
  return sheet;
}

function parseJsonCell_(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; }
  catch (error) { return fallback; }
}

function collectOptionImageRefs_(value) {
  const refs = [];
  const visit = function(item) {
    if (!item) return;
    if (typeof item === 'string') {
      if (extractFileId_(item)) refs.push(item);
    } else if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (typeof item === 'object') {
      Object.keys(item).forEach(key => visit(item[key]));
    }
  };
  visit(value);
  return Array.from(new Set(refs));
}

function clearQuestionImageAllowlistCache_() {
  CacheService.getScriptCache().remove('QUESTION_IMAGE_IDS_V1');
}

function getQuestionImageIdAllowlist_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'QUESTION_IMAGE_IDS_V1';
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return new Set(JSON.parse(cached)); } catch (error) {}
  }

  const allowedIds = new Set();
  const sheet = ensureBankSoalExtraColumns_();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const questionImageId = extractFileId_(rows[i][6]);
    if (questionImageId) allowedIds.add(questionImageId);
    const optionImages = parseJsonCell_(rows[i][10], []);
    collectOptionImageRefs_(optionImages).forEach(function(ref) {
      const id = extractFileId_(ref);
      if (id) allowedIds.add(id);
    });
  }

  try { cache.put(cacheKey, JSON.stringify(Array.from(allowedIds)), 300); } catch (error) {}
  return allowedIds;
}

function getQuestionImageRefsFromRow_(row) {
  const refs = [];
  if (row && row[6]) refs.push(String(row[6]));
  collectOptionImageRefs_(parseJsonCell_(row && row[10], [])).forEach(ref => refs.push(ref));
  return refs;
}

function isFileInFolder_(file, folderId) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
}

function cleanupUnreferencedManagedImages_(candidateRefs) {
  if (!Array.isArray(candidateRefs) || !candidateRefs.length) return;
  const sheet = ensureBankSoalExtraColumns_();
  const rows = sheet.getDataRange().getValues();
  const activeIds = new Set();

  for (let i = 1; i < rows.length; i++) {
    const questionId = extractFileId_(rows[i][6]);
    if (questionId) activeIds.add(questionId);
    collectOptionImageRefs_(parseJsonCell_(rows[i][10], [])).forEach(function(ref) {
      const id = extractFileId_(ref);
      if (id) activeIds.add(id);
    });
  }

  const folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!folderId) return;

  Array.from(new Set(candidateRefs.map(extractFileId_).filter(Boolean))).forEach(function(fileId) {
    if (activeIds.has(fileId)) return;
    try {
      const file = DriveApp.getFileById(fileId);
      // Jangan pernah menghapus file sumber yang diimpor dari folder Drive lain.
      if (isFileInFolder_(file, folderId)) file.setTrashed(true);
    } catch (error) {
      Logger.log('Pembersihan gambar terlewat untuk ' + fileId + ': ' + error.message);
    }
  });
}

function copyDriveImageIntoMediaFolder_(driveReference, copiedIdMap, createdCopyIds) {
  if (!driveReference) return '';
  const sourceId = extractFileId_(driveReference);
  if (!sourceId) throw new Error('ID file gambar Google Drive tidak valid.');
  if (copiedIdMap[sourceId]) return 'DRIVE_ID:' + copiedIdMap[sourceId];

  const sourceFile = DriveApp.getFileById(sourceId);
  const mimeType = String(sourceFile.getMimeType() || '').toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    throw new Error('File ' + sourceFile.getName() + ' bukan gambar PNG, JPG, atau WEBP.');
  }
  if (sourceFile.getSize() > 2 * 1024 * 1024) {
    throw new Error('Gambar ' + sourceFile.getName() + ' melebihi batas 2 MB.');
  }

  const mediaFolder = getOrCreateDriveFolder_();
  if (isFileInFolder_(sourceFile, mediaFolder.getId())) {
    copiedIdMap[sourceId] = sourceId;
    return 'DRIVE_ID:' + sourceId;
  }

  const copiedFile = sourceFile.makeCopy(sourceFile.getName(), mediaFolder);
  copiedIdMap[sourceId] = copiedFile.getId();
  createdCopyIds.push(copiedFile.getId());
  return 'DRIVE_ID:' + copiedFile.getId();
}

function copyQuestionImagesIntoMediaFolder_(question, copiedIdMap, createdCopyIds) {
  question.url_gambar = question.url_gambar
    ? copyDriveImageIntoMediaFolder_(question.url_gambar, copiedIdMap, createdCopyIds)
    : '';

  question.opsi_gambar = (Array.isArray(question.opsi_gambar) ? question.opsi_gambar : []).map(function(item) {
    if (typeof item === 'string') {
      return item ? copyDriveImageIntoMediaFolder_(item, copiedIdMap, createdCopyIds) : '';
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return {
        kunci: item.kunci ? copyDriveImageIntoMediaFolder_(item.kunci, copiedIdMap, createdCopyIds) : '',
        nilai: item.nilai ? copyDriveImageIntoMediaFolder_(item.nilai, copiedIdMap, createdCopyIds) : '',
        url: item.url ? copyDriveImageIntoMediaFolder_(item.url, copiedIdMap, createdCopyIds) : ''
      };
    }
    return '';
  });
}

function rollbackImportedMediaCopies_(createdCopyIds) {
  (createdCopyIds || []).forEach(function(fileId) {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (error) {}
  });
}



function getAllSoal_(bypassCache = false) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'BANK_SOAL_DATA_V2';

  if (!bypassCache) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  }

  const sheet = ensureBankSoalExtraColumns_();
  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const parsedOpsi = parseJsonCell_(data[i][3], []);
    const parsedKunci = parseJsonCell_(data[i][4], null);
    const parsedOpsiGambar = parseJsonCell_(data[i][10], []);

    result.push({
      id: SecurityService.sanitizeData(data[i][0]),
      tipe: SecurityService.sanitizeData(data[i][1]),
      pertanyaan: SecurityService.sanitizeHtml(data[i][2]),
      opsi: SecurityService.sanitizeHtmlData(parsedOpsi),
      kunci_jawaban: SecurityService.sanitizeHtmlData(parsedKunci),
      bobot: Number(data[i][5]) || 0,
      url_gambar: SecurityService.sanitizeData(data[i][6] || ''),
      mapel: SecurityService.sanitizeData(data[i][7] || ''),
      petunjuk: String(data[i][8] || ''),
      teks_pendukung: SecurityService.sanitizeHtml(data[i][9] || ''),
      opsi_gambar: SecurityService.sanitizeData(parsedOpsiGambar)
    });
  }

  try { cache.put(cacheKey, JSON.stringify(result), 3600); }
  catch (error) { console.warn('Bank soal dibaca langsung; cache tidak tersedia: ' + error.message); }
  return result;
}



function getAllSoalForExport_() {
  const sheet = ensureBankSoalExtraColumns_();
  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    result.push({
      id: String(data[i][0] == null ? '' : data[i][0]),
      tipe: String(data[i][1] == null ? '' : data[i][1]),
      pertanyaan: String(data[i][2] == null ? '' : data[i][2]),
      opsi: parseJsonCell_(data[i][3], []),
      kunci_jawaban: parseJsonCell_(data[i][4], null),
      bobot: Number(data[i][5]) || 0,
      url_gambar: String(data[i][6] == null ? '' : data[i][6]),
      mapel: String(data[i][7] == null ? '' : data[i][7]),
      petunjuk: String(data[i][8] == null ? '' : data[i][8]),
      teks_pendukung: String(data[i][9] == null ? '' : data[i][9]),
      opsi_gambar: parseJsonCell_(data[i][10], [])
    });
  }
  return result;
}


function createSoal_(dataSoal) {
  if (!dataSoal || !['PG','PG Kompleks','Isian Singkat','Menjodohkan','Benar Salah','Sesuai Tidak Sesuai'].includes(dataSoal.tipe))
    return { success:false, message:'Tipe soal tidak diizinkan untuk disimpan.' };
  const validation = validateBenarSalahQuestion_(dataSoal);
  if (!validation.success) return validation;
  const typeValidation = validateSesuaiQuestion_(dataSoal);
  if (!typeValidation.success) return typeValidation;
  if (dataSoal.tipe === 'Esai') return { success: false, message: 'Pembuatan soal esai sudah dinonaktifkan.' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = ensureBankSoalExtraColumns_();
    const idSoal = 'SOAL_' + new Date().getTime() + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);

    sheet.appendRow([
      idSoal,
      dataSoal.tipe,
      dataSoal.pertanyaan,
      JSON.stringify(dataSoal.opsi || []),
      JSON.stringify(dataSoal.kunci_jawaban),
      dataSoal.bobot || 1,
      dataSoal.url_gambar || '',
      dataSoal.mapel || '',
      dataSoal.petunjuk || '',
      dataSoal.teks_pendukung || '',
      JSON.stringify(dataSoal.opsi_gambar || [])
    ]);

    CacheService.getScriptCache().remove('BANK_SOAL_DATA_V2');
    clearQuestionImageAllowlistCache_();
    return { success: true, message: 'Soal berhasil ditambahkan.', id: idSoal };
  } catch (e) {
    return { success: false, message: 'Gagal menambah soal: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}


function extractFileId_(driveReference) {
  if (!driveReference) return '';
  const reference = String(driveReference).trim();
  if (reference.indexOf('DRIVE_ID:') === 0) {
    return reference.substring('DRIVE_ID:'.length).trim();
  }

  let match = reference.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (!match) match = reference.match(/\/d\/([a-zA-Z0-9_-]+)/i);
  if (!match) match = reference.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(reference)) return reference;
  return '';
}


function updateSoal_(id, dataSoal) {
  if (!dataSoal || !['PG','PG Kompleks','Isian Singkat','Menjodohkan','Benar Salah','Sesuai Tidak Sesuai'].includes(dataSoal.tipe))
    return { success:false, message:'Tipe soal tidak diizinkan untuk disimpan.' };
  const validation = validateBenarSalahQuestion_(dataSoal);
  if (!validation.success) return validation;
  const typeValidation = validateSesuaiQuestion_(dataSoal);
  if (!typeValidation.success) return typeValidation;
  if (dataSoal.tipe === 'Esai') return { success: false, message: 'Pembuatan soal esai sudah dinonaktifkan.' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = ensureBankSoalExtraColumns_();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const oldImageRefs = getQuestionImageRefsFromRow_(data[i]);
        const oldOptionImages = parseJsonCell_(data[i][10], []);
        const newOptionImages = dataSoal.opsi_gambar !== undefined ? dataSoal.opsi_gambar : oldOptionImages;

        const row = i + 1;
        const newQuestionImage = dataSoal.url_gambar !== undefined ? dataSoal.url_gambar : data[i][6];
        const newMapel = dataSoal.mapel !== undefined ? dataSoal.mapel : data[i][7];
        const newPetunjuk = dataSoal.petunjuk !== undefined ? dataSoal.petunjuk : data[i][8];
        const newTeksPendukung = dataSoal.teks_pendukung !== undefined ? dataSoal.teks_pendukung : data[i][9];

        sheet.getRange(row, 2, 1, 10).setValues([[
          dataSoal.tipe,
          dataSoal.pertanyaan,
          JSON.stringify(dataSoal.opsi || []),
          JSON.stringify(dataSoal.kunci_jawaban),
          dataSoal.bobot || 1,
          newQuestionImage,
          newMapel,
          newPetunjuk,
          newTeksPendukung,
          JSON.stringify(newOptionImages || [])
        ]]);

        CacheService.getScriptCache().remove('BANK_SOAL_DATA_V2');
        clearQuestionImageAllowlistCache_();
        cleanupUnreferencedManagedImages_(oldImageRefs);
        return { success: true, message: 'Soal berhasil diupdate.' };
      }
    }
    return { success: false, message: 'Soal tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal update soal: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}


function deleteSoal_(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = ensureBankSoalExtraColumns_();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const oldImageRefs = getQuestionImageRefsFromRow_(data[i]);
        sheet.deleteRow(i + 1);
        CacheService.getScriptCache().remove('BANK_SOAL_DATA_V2');
        clearQuestionImageAllowlistCache_();
        cleanupUnreferencedManagedImages_(oldImageRefs);
        return { success: true, message: 'Soal berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Soal tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus soal: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}


function deleteMultipleSoal_(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, message: 'Tidak ada soal yang dipilih.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const sheet = ensureBankSoalExtraColumns_();
    const data = sheet.getDataRange().getValues();
    let deletedCount = 0;
    const oldImageRefs = [];

    for (let i = data.length - 1; i >= 1; i--) {
      if (ids.includes(data[i][0])) {
        oldImageRefs.push.apply(oldImageRefs, getQuestionImageRefsFromRow_(data[i]));
        sheet.deleteRow(i + 1);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      CacheService.getScriptCache().remove('BANK_SOAL_DATA_V2');
      clearQuestionImageAllowlistCache_();
      cleanupUnreferencedManagedImages_(oldImageRefs);
      return { success: true, message: `${deletedCount} soal berhasil dihapus.` };
    }
    return { success: false, message: 'Tidak ada soal cocok yang bisa dihapus.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus beberapa soal: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}


function uploadImage_(base64Data, filename) {
  try {
    if (!base64Data || typeof base64Data !== 'string') {
      return { success: false, message: 'Data gambar tidak valid.' };
    }

    const splitData = base64Data.split(',');
    if (splitData.length < 2) {
      return { success: false, message: 'Format data gambar tidak valid.' };
    }

    const contentTypeMatch = splitData[0].match(/^data:(image\/(?:png|jpeg|webp));base64$/i);
    if (!contentTypeMatch) {
      return { success: false, message: 'Format gambar yang diizinkan hanya PNG, JPG, atau WEBP.' };
    }

    const contentType = contentTypeMatch[1].toLowerCase();
    const decodedBytes = Utilities.base64Decode(splitData[1]);
    if (decodedBytes.length > 2 * 1024 * 1024) {
      return { success: false, message: 'Ukuran gambar setelah kompresi melebihi 2 MB.' };
    }

    const safeFilename = String(filename || ('img_' + new Date().getTime())).replace(/[^a-zA-Z0-9._-]/g, '_');
    const blob = Utilities.newBlob(decodedBytes, contentType, safeFilename);
    const folder = getOrCreateDriveFolder_();
    const file = folder.createFile(blob);
    return { success: true, url: 'DRIVE_ID:' + file.getId() };
  } catch (e) {
    Logger.log('uploadImage error: ' + e.message);
    return { success: false, message: 'Gagal upload gambar: ' + e.message };
  }
}

function getImageBase64(driveReference, auth) {
  if (!authorizeMediaRead_(auth)) return '';
  try {
    const fileId = extractFileId_(driveReference);
    if (!fileId || !getQuestionImageIdAllowlist_().has(fileId)) return '';

    const file = DriveApp.getFileById(fileId);
    const mimeType = String(file.getMimeType() || '').toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return '';
    if (file.getSize() > 2 * 1024 * 1024) return '';

    const blob = file.getBlob();
    return 'data:' + mimeType + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    Logger.log('getImageBase64 error: ' + e.message);
    return '';
  }
}

function getMultipleImageBase64(driveReferences, auth) {
  if (!authorizeMediaRead_(auth)) return {};
  const result = {};
  const maxFileSize = 2 * 1024 * 1024;
  if (!Array.isArray(driveReferences) || driveReferences.length === 0 || driveReferences.length > 100) return result;

  const allowedIds = getQuestionImageIdAllowlist_();
  for (let i = 0; i < driveReferences.length; i++) {
    const ref = driveReferences[i];
    if (!ref) continue;
    try {
      const fileId = extractFileId_(ref);
      if (!fileId || !allowedIds.has(fileId)) {
        result[ref] = '';
        continue;
      }

      const file = DriveApp.getFileById(fileId);
      const mimeType = String(file.getMimeType() || '').toLowerCase();
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || file.getSize() > maxFileSize) {
        result[ref] = '';
        continue;
      }

      const blob = file.getBlob();
      result[ref] = 'data:' + mimeType + ';base64,' + Utilities.base64Encode(blob.getBytes());
    } catch (e) {
      Logger.log('getMultipleImageBase64 error untuk ref ' + ref + ': ' + e.message);
      result[ref] = '';
    }
  }
  return result;
}

function normalizeImportedDriveImageRef_(reference) {
  if (reference === null || typeof reference === 'undefined' || String(reference).trim() === '') return '';
  const raw = String(reference).trim();
  if (raw.indexOf('DRIVE_ID:') === 0) {
    const id = extractFileId_(raw);
    if (!id) throw new Error('Referensi gambar Google Drive tidak valid.');
    return 'DRIVE_ID:' + id;
  }

  const id = extractFileId_(raw);
  const isDriveUrl = /^https?:\/\/(drive|docs)\.google\.com\//i.test(raw);
  const isBareId = /^[a-zA-Z0-9_-]{10,}$/.test(raw);
  if (!id || (!isDriveUrl && !isBareId)) {
    throw new Error('Tautan gambar harus berupa tautan file Google Drive yang valid.');
  }
  return 'DRIVE_ID:' + id;
}

function normalizeImportedQuestionImages_(question) {
  question.url_gambar = normalizeImportedDriveImageRef_(question.url_gambar || '');

  const rawImages = Array.isArray(question.opsi_gambar) ? question.opsi_gambar : [];
  question.opsi_gambar = rawImages.map(function(item) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return {
        kunci: normalizeImportedDriveImageRef_(item.kunci || ''),
        nilai: normalizeImportedDriveImageRef_(item.nilai || ''),
        url: normalizeImportedDriveImageRef_(item.url || '')
      };
    }
    return normalizeImportedDriveImageRef_(item || '');
  });
}

function validateImportedQuestion_(question) {
  const supportedTypes = ['PG', 'PG Kompleks', 'Isian Singkat', 'Menjodohkan', 'Benar Salah', 'Sesuai Tidak Sesuai'];
  if (!question || supportedTypes.indexOf(question.tipe) === -1) {
    return { success: false, message: 'Tipe soal tidak didukung.' };
  }
  if (!String(question.pertanyaan || '').trim()) {
    return { success: false, message: 'Pertanyaan wajib diisi.' };
  }

  const options = Array.isArray(question.opsi) ? question.opsi : [];
  const keys = question.kunci_jawaban;

  if (question.tipe === 'PG') {
    if (options.length < 2) return { success: false, message: 'Soal PG minimal memiliki 2 opsi.' };
    if (typeof keys !== 'string' || !keys || options.indexOf(keys) === -1) {
      return { success: false, message: 'Kunci jawaban PG harus sesuai dengan salah satu opsi.' };
    }
  } else if (question.tipe === 'PG Kompleks') {
    if (options.length < 2) return { success: false, message: 'Soal PG Kompleks minimal memiliki 2 opsi.' };
    if (!Array.isArray(keys) || !keys.length || keys.some(function(key) { return options.indexOf(key) === -1; })) {
      return { success: false, message: 'Kunci jawaban PG Kompleks tidak sesuai dengan opsi.' };
    }
  } else if (question.tipe === 'Isian Singkat') {
    if (!String(keys == null ? '' : keys).trim()) {
      return { success: false, message: 'Kunci jawaban Isian Singkat wajib diisi.' };
    }
  } else if (question.tipe === 'Menjodohkan') {
    if (options.length < 2 || !keys || typeof keys !== 'object' || Array.isArray(keys)) {
      return { success: false, message: 'Soal Menjodohkan minimal memiliki 2 pasangan kunci.' };
    }
    const leftValues = options.map(function(pair) {
      const parts = String(pair || '').split(':::');
      return parts[0] || '';
    });
    const rightValues = options.map(function(pair) {
      const parts = String(pair || '').split(':::');
      return parts.slice(1).join(':::') || '';
    });
    if (leftValues.some(function(value) { return !value; }) ||
        rightValues.some(function(value) { return !value; }) ||
        Object.keys(keys).length < 2 ||
        Object.keys(keys).some(function(left) {
          return leftValues.indexOf(left) === -1 || rightValues.indexOf(String(keys[left])) === -1;
        })) {
      return { success: false, message: 'Pasangan Menjodohkan tidak lengkap atau kunci tidak sesuai.' };
    }
  } else if (question.tipe === 'Sesuai Tidak Sesuai') {
    const validation = validateSesuaiQuestion_(question);
    if (!validation.success) return validation;
  } else if (question.tipe === 'Benar Salah') {
    const validation = validateBenarSalahQuestion_(question);
    if (!validation.success) return validation;
  }

  return { success: true };
}

function importSoal_(dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return { success: false, message: 'Data soal kosong.' };
  }

  const normalizedQuestions = [];
  const databaseForValidation = getOrCreateSpreadsheet_();
  const mapelSheet = databaseForValidation.getSheetByName('Daftar_Mapel');
  const registeredMapel = [];
  if (mapelSheet && mapelSheet.getLastRow() > 1) {
    const mapelValues = mapelSheet.getRange(2, 2, mapelSheet.getLastRow() - 1, 1).getValues();
    mapelValues.forEach(function(row) {
      const name = String(row[0] == null ? '' : row[0]).trim();
      if (name) registeredMapel.push(name);
    });
  }

  for (let i = 0; i < dataArray.length; i++) {
    const source = dataArray[i] || {};
    const question = {
      tipe: String(source.tipe || '').trim(),
      pertanyaan: String(source.pertanyaan || ''),
      petunjuk: String(source.petunjuk || ''),
      teks_pendukung: String(source.teks_pendukung || ''),
      opsi: Array.isArray(source.opsi) ? source.opsi.map(function(value) { return String(value == null ? '' : value); }) : [],
      opsi_gambar: Array.isArray(source.opsi_gambar) ? source.opsi_gambar : [],
      kunci_jawaban: source.kunci_jawaban,
      bobot: Number(source.bobot || 1),
      url_gambar: source.url_gambar || '',
      mapel: String(source.mapel || '').trim()
    };

    if (!Number.isFinite(question.bobot) || question.bobot < 1) {
      return { success: false, message: 'Baris import ke-' + (i + 1) + ': bobot minimal 1.' };
    }
    if (question.mapel && registeredMapel.length && registeredMapel.indexOf(question.mapel) === -1) {
      return {
        success: false,
        message: 'Baris import ke-' + (i + 1) + ': mata pelajaran "' + question.mapel + '" belum terdaftar. Samakan dengan menu Mata Pelajaran.'
      };
    }

    try {
      normalizeImportedQuestionImages_(question);
    } catch (imageError) {
      return { success: false, message: 'Baris import ke-' + (i + 1) + ': ' + imageError.message };
    }

    const validation = validateImportedQuestion_(question);
    if (!validation.success) {
      return { success: false, message: 'Baris import ke-' + (i + 1) + ': ' + validation.message };
    }
    normalizedQuestions.push(question);
  }

  const createdMediaCopyIds = [];
  try {
    const copiedIdMap = {};
    normalizedQuestions.forEach(function(question, index) {
      try {
        copyQuestionImagesIntoMediaFolder_(question, copiedIdMap, createdMediaCopyIds);
      } catch (copyError) {
        throw new Error('Baris import ke-' + (index + 1) + ': ' + copyError.message);
      }
    });
  } catch (copyError) {
    rollbackImportedMediaCopies_(createdMediaCopyIds);
    return { success: false, message: copyError.message };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);

    const sheet = ensureBankSoalExtraColumns_();
    const timestamp = new Date().getTime();
    const mapped = normalizedQuestions.map(function(question, index) {
      const idSoal = 'SOAL_' + timestamp + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 8) + '_' + index;
      return [
        idSoal,
        question.tipe,
        question.pertanyaan,
        JSON.stringify(question.opsi || []),
        JSON.stringify(question.kunci_jawaban),
        question.bobot,
        question.url_gambar || '',
        question.mapel || '',
        question.petunjuk || '',
        question.teks_pendukung || '',
        JSON.stringify(question.opsi_gambar || [])
      ];
    });

    const firstRow = sheet.getLastRow() + 1;
    sheet.getRange(firstRow, 1, mapped.length, 11).setValues(mapped);
    CacheService.getScriptCache().remove('BANK_SOAL_DATA_V2');
    clearQuestionImageAllowlistCache_();

    return {
      success: true,
      count: mapped.length,
      message: mapped.length + ' soal berhasil diimpor.'
    };
  } catch (error) {
    rollbackImportedMediaCopies_(createdMediaCopyIds);
    console.error('Import soal gagal: ' + error.message);
    return { success: false, message: 'Gagal mengimpor soal: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

