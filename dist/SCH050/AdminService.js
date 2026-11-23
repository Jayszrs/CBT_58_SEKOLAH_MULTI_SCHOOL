

function executeAdminAction(password, actionName, args) {
  console.log('Admin Action Request:', { action: actionName });
  
  if (!verifyAdminCredential_(password)) {
    return { success: false, sessionExpired: true, message: 'Sesi admin tidak valid atau berakhir. Silakan login kembali.' };
  }
  args = args && typeof args === 'object' ? args : {};
  
  let result;
  
  switch(actionName) {
    case 'ping':
      return { success: true, message: 'pong' };
    case 'getAllPaketSoal':
      result = getAllPaketSoal_(args.bypassCache);
      break;
    case 'createPaketSoal':
      result = createPaketSoal_(args.data);
      break;
    case 'updatePaketSoal':
      result = updatePaketSoal_(args.idPaket, args.data);
      break;
    case 'deletePaketSoal':
      result = deletePaketSoal_(args.idPaket);
      break;
    case 'getSiswa':
      result = getAllSiswa_(args.bypassCache);
      break;
    case 'exportSiswa':
      result = getAllSiswaForExport_();
      break;
    case 'createSiswa':
      result = createSiswa_(args.data);
      break;
    case 'updateSiswa':
      result = updateSiswa_(args.nisn, args.data);
      break;
    case 'deleteSiswa':
      result = deleteSiswa_(args.nisn);
      break;
    case 'resetAllSiswaStatus':
      result = resetAllSiswaStatus_();
      break;
    case 'importSiswa':
      result = importSiswa_(args.dataArray);
      break;
    case 'importSoal':
      result = importSoal_(args.dataArray);
      break;
    case 'exportSoal':
      result = getAllSoalForExport_();
      break;
    case 'getAllSoal':
      result = getAllSoal_(!!args.bypassCache);
      break;
    case 'createSoal':
      result = createSoal_(args.data);
      break;
    case 'updateSoal':
      result = updateSoal_(args.id, args.data);
      break;
    case 'deleteSoal':
      result = deleteSoal_(args.id);
      break;
    case 'deleteMultipleSoal':
      result = deleteMultipleSoal_(args.ids);
      break;
    case 'uploadImage':
      result = uploadImage_(args.base64Data, args.filename);
      break;
    case 'logoutSiswa':
      result = logoutSiswa_(args.nisn);
      break;
    case 'getKelas':
      result = getAllKelas_();
      break;
    case 'importKelas':
      result = importKelas_(args.dataArray);
      break;
    case 'saveKelas':
      result = saveKelas_(args.idLama, args.data);
      break;
    case 'deleteKelas':
      result = deleteKelas_(args.id);
      break;
    case 'getMapel':
      result = getAllMapel_();
      break;
    case 'saveMapel':
      result = saveMapel_(args.idLama, args.data);
      break;
    case 'deleteMapel':
      result = deleteMapel_(args.id);
      break;
    case 'getConfig':
      result = getUjianConfig_();
      break;
    case 'setConfig':
      result = setUjianConfig_(args.config);
      break;
    case 'getStatistik':
      result = getStatistikUjian_();
      break;
    case 'getRekapNilai':
      result = getRekapNilai_();
      break;
    case 'getJawabanSiswa':
      result = getJawabanSiswa_(args.nisn);
      break;
    case 'getPrintAnalysisIndex':
      result = getPrintAnalysisIndex_(args.mapelFilter || '');
      break;
    case 'getPrintAnalysisReport':
      result = getPrintAnalysisReport_(args.nisn, args.mapelFilter || '');
      break;
    case 'getPrintAnalysisMatrix':
      result = getPrintAnalysisMatrix_(args.mapelFilter || '');
      break;
    case 'getPrintAnalysisAll':
      result = getPrintAnalysisAll_(args.mapelFilter || '');
      break;
    case 'saveEssayScore':
      result = saveEssayScore_(args.nisn, args.skor, args.detailSkor);
      break;
    case 'changePassword':
      result = changeAdminPassword_(args.oldPassword, args.newPassword);
      break;
    case 'setSchoolAdminPassword':
      result = setSchoolAdminPassword_(password, args.newPassword);
      break;
    case 'uploadLogoApp':
      result = uploadLogoApp_(args);
      break;
    case 'archiveJawaban':
      result = archiveJawaban_(args.mapelFilter);
      break;
    case 'unarchiveJawaban':
      result = unarchiveJawaban_(args.mapelFilter);
      break;
    case 'getArsipStats':
      result = getArsipStats_();
      break;
    default:
      result = { success: false, message: 'Action tidak valid' };
  }
  return result;
}


function getAllSiswa_(bypassCache) {
  const cacheServiceInstance = CacheService.getScriptCache();
  const cacheKeyIdentifier = 'DATA_SISWA';

  if (!bypassCache) {
    const cachedDataString = cacheServiceInstance.get(cacheKeyIdentifier);
    if (cachedDataString) {
      return JSON.parse(cachedDataString);
    }
  }

  const spreadsheetInstance = getOrCreateSpreadsheet_();
  const sheetObject = spreadsheetInstance.getSheetByName('Data_Siswa');
  const rawSpreadsheetData = sheetObject.getDataRange().getValues();
  const sanitizedResponseData = [];

  for (let i = 1; i < rawSpreadsheetData.length; i++) {
    sanitizedResponseData.push({
      nisn: SecurityService.sanitizeData(rawSpreadsheetData[i][0]),
      nama: SecurityService.sanitizeData(rawSpreadsheetData[i][1]),
      kelas: SecurityService.sanitizeData(rawSpreadsheetData[i][2]),
      password: SecurityService.sanitizeData(rawSpreadsheetData[i][3]),
      status: SecurityService.sanitizeData(rawSpreadsheetData[i][4])
    });
  }

  try {
    cacheServiceInstance.put(cacheKeyIdentifier, JSON.stringify(sanitizedResponseData), 600);
    console.log('Operasi berhasil: Data siswa berhasil disanitasi dari potensi injeksi dan tersimpan di sistem cache.');
  } catch (error) {
    console.error('Kritis: Gagal menyimpan data siswa ke dalam cache. Detail:', error);
  }

  return sanitizedResponseData;
}


function getAllSiswaForExport_() {
  const spreadsheet = getOrCreateSpreadsheet_();
  const sheet = spreadsheet.getSheetByName('Data_Siswa');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  return values.map(function(row) {
    return {
      nisn: String(row[0] == null ? '' : row[0]),
      nama: String(row[1] == null ? '' : row[1]),
      kelas: String(row[2] == null ? '' : row[2]),
      password: String(row[3] == null ? '' : row[3])
    };
  });
}

function createSiswa_(s) {
  const validation = validateStudentRecord_(s);
  if (!validation.success) return validation;
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Data_Siswa');
  if (sheet.getDataRange().getValues().slice(1).some(row=>String(row[0])===String(s.nisn).trim())) return {success:false,message:'NISN sudah terdaftar.'};
  const row = [String(s.nisn).trim(), String(s.nama).trim(), String(s.kelas).trim(), String(s.password || ''), 'Offline'];
  sheet.getRange(sheet.getLastRow()+1,1,1,5).setNumberFormat('@').setValues([row.map(safeSheetLiteral_)]);
  CacheService.getScriptCache().remove('DATA_SISWA');
  return { success: true };
}

function updateSiswa_(nisnLama, s) {
  const validation = validateStudentRecord_(s);
  if (!validation.success) return validation;
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Data_Siswa');
  const data = sheet.getDataRange().getValues();

  if (data.slice(1).some(row=>String(row[0])!==String(nisnLama)&&String(row[0])===String(s.nisn).trim())) return {success:false,message:'NISN sudah terdaftar.'};

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nisnLama)) {
      const statusValue = s.status !== undefined ? s.status : data[i][4];
      const nisnBaru = s.nisn !== undefined ? s.nisn : nisnLama;
      
      sheet.getRange(i + 1, 1, 1, 5).setNumberFormat('@').setValues([[nisnBaru, s.nama, s.kelas, s.password, statusValue].map(safeSheetLiteral_)]);
      CacheService.getScriptCache().remove('DATA_SISWA');
      
      
      if (String(nisnBaru) !== String(nisnLama)) {
        const sheetRespon = ss.getSheetByName('Respon_Jawaban');
        const responData = sheetRespon.getDataRange().getValues();
        const batchUpdates = [];
        
        for (let j = 1; j < responData.length; j++) {
          if (String(responData[j][1]) === String(nisnLama)) {
            batchUpdates.push({row: j + 1, col: 2, val: nisnBaru});
          }
        }
        
        if (batchUpdates.length > 0) {
          batchUpdates.forEach(function(u) {
            sheetRespon.getRange(u.row, u.col).setNumberFormat('@').setValue(u.val);
          });
          CacheService.getScriptCache().remove('REKAP_NILAI');
        }
      }
      
      return { success: true };
    }
  }
  return { success: false, message: 'Siswa tidak ditemukan' };
}

function deleteSiswa_(nisn) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Data_Siswa');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nisn)) {
      sheet.deleteRow(i + 1);
      CacheService.getScriptCache().remove('DATA_SISWA');
      return { success: true };
    }
  }
  return { success: false };
}

function resetAllSiswaStatus_() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getOrCreateSpreadsheet_();
    const sheet = ss.getSheetByName('Data_Siswa');
    const data = sheet.getDataRange().getValues();
    
    let updatedCount = 0;
    
    if (data.length > 1) {
      const batchUpdates = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][4] === 'Aktif' || data[i][4] === 'Selesai') {
          batchUpdates.push({row: i + 1, col: 5, value: 'Offline'});
        }
      }
      
      if (batchUpdates.length > 0) {
        updatedCount = batchUpdates.length;
        
        
        const rangeList = batchUpdates.map(function(u) {
          return sheet.getRange(u.row, u.col);
        });
        batchUpdates.forEach(function(u, idx) {
          rangeList[idx].setValue(u.value);
        });
        SpreadsheetApp.flush();
        CacheService.getScriptCache().remove('DATA_SISWA');

        
        try {
          const firebaseDatabaseInstance = new FirebaseDatabaseService();
          batchUpdates.forEach(function(u) {
            const rowData = data[u.row - 1]; 
            const nisn = String(rowData[0]);
            firebaseDatabaseInstance.patchData('sesi_siswa/' + nisn, { status: 'Offline' });
          });
        } catch (fbError) {
          console.error('Peringatan: Gagal sinkronisasi reset status ke Firebase: ' + fbError.message);
        }
      }
    }
    return { success: true, count: updatedCount };
  } catch (e) {
    return { success: false, message: 'Gagal mereset status: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

function importSiswa_(dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return { success: false, message: 'Data peserta kosong.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const ss = getOrCreateSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, 'Data_Siswa', ['NISN', 'Nama', 'Kelas', 'Password', 'Status Login']);
    const currentData = sheet.getDataRange().getValues();
    const existingNisn = new Set();
    for (let i = 1; i < currentData.length; i++) {
      const value = String(currentData[i][0] == null ? '' : currentData[i][0]).trim();
      if (value) existingNisn.add(value);
    }

    const seenInFile = new Set();
    const rowsToInsert = [];
    const importedClasses = new Set();
    let skippedDuplicate = 0;
    const errors = [];

    dataArray.forEach(function(item, index) {
      const values = Array.isArray(item)
        ? item
        : [item && item.nisn, item && item.nama, item && item.kelas, item && item.password];

      const nisn = String(values[0] == null ? '' : values[0]).trim();
      const nama = String(values[1] == null ? '' : values[1]).trim();
      const kelas = String(values[2] == null ? '' : values[2]).trim();
      const password = String(values[3] == null ? '' : values[3]).trim();
      const rowNumber = index + 2;

      if (!nisn || !nama || !kelas || !password) {
        errors.push('Baris ' + rowNumber + ': NISN, Nama Siswa, Kelas, dan Password wajib diisi.');
        return;
      }
      if (!normalizeStudentId_(nisn) || nama.length > 200 || kelas.length > 100 || password.length > 200) {
        errors.push('Baris ' + rowNumber + ': terdapat data yang melebihi batas panjang kolom.');
        return;
      }
      if (seenInFile.has(nisn)) {
        skippedDuplicate++;
        return;
      }
      seenInFile.add(nisn);

      if (existingNisn.has(nisn)) {
        skippedDuplicate++;
        return;
      }

      rowsToInsert.push([nisn, nama, kelas, password, 'Offline']);
      importedClasses.add(kelas);
      existingNisn.add(nisn);
    });

    if (errors.length) {
      return {
        success: false,
        message: 'Import dibatalkan karena ada data yang belum valid: ' + errors.slice(0, 5).join(' '),
        errors: errors
      };
    }

    if (rowsToInsert.length) {
      const firstRow = sheet.getLastRow() + 1;
      const targetRange = sheet.getRange(firstRow, 1, rowsToInsert.length, 5);
      targetRange.setNumberFormat('@');
      targetRange.setValues(rowsToInsert.map(row=>row.map(safeSheetLiteral_)));
    }

    // Daftarkan kelas baru agar kelas peserta juga tersedia pada dropdown administrator.
    const classSheet = getOrCreateSheet_(ss, 'Daftar_Kelas', ['ID Kelas', 'Nama Kelas']);
    const classData = classSheet.getDataRange().getValues();
    const existingClassNames = new Set();
    for (let i = 1; i < classData.length; i++) {
      existingClassNames.add(String(classData[i][1] == null ? '' : classData[i][1]).trim().toLowerCase());
    }

    importedClasses.forEach(function(className) {
      const normalizedName = String(className).trim().toLowerCase();
      if (!normalizedName || existingClassNames.has(normalizedName)) return;
      classSheet.appendRow(['IMP_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), className]);
      existingClassNames.add(normalizedName);
    });

    CacheService.getScriptCache().remove('DATA_SISWA');
    CacheService.getScriptCache().remove('GLOBAL_CONFIG_CACHE');

    return {
      success: true,
      count: rowsToInsert.length,
      skippedDuplicate: skippedDuplicate,
      message: rowsToInsert.length + ' peserta berhasil ditambahkan.'
    };
  } catch (error) {
    console.error('Import siswa gagal: ' + error.message);
    return { success: false, message: 'Gagal mengimpor peserta: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function validateStudentRecord_(record) {
  if (!record || !normalizeStudentId_(record.nisn)) return {success:false,message:'NISN harus 1–32 huruf, angka, tanda hubung, atau garis bawah.'};
  if (!String(record.nama || '').trim() || String(record.nama).length>200 || !String(record.kelas || '').trim() || String(record.kelas).length>100 || String(record.password || '').length>200) return {success:false,message:'Nama dan kelas wajib diisi; periksa panjang data siswa.'};
  return {success:true};
}

function importKelas_(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length>5000) return {success:false,message:'Isi 1–5000 kelas per file.'};
  const lock=LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ss=getOrCreateSpreadsheet_();
    const sheet=getOrCreateSheet_(ss,'Daftar_Kelas',['ID Kelas','Nama Kelas']);
    const existing=sheet.getDataRange().getValues().slice(1);
    const ids=new Set(existing.map(r=>String(r[0])));
    const names=new Set(existing.map(r=>String(r[1]).trim().toLowerCase()));
    const insert=[]; let skipped=0;
    for(let i=0;i<rows.length;i++) {
      const nama=String(rows[i]?.nama || '').trim();
      const id=String(rows[i]?.id || ('KLS-'+Utilities.getUuid().slice(0,8))).trim();
      if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||!nama||nama.length>100) return {success:false,message:'Baris '+(i+2)+': kode/nama kelas tidak valid.'};
      if(ids.has(id)||names.has(nama.toLowerCase())) {skipped++;continue;}
      ids.add(id);names.add(nama.toLowerCase());insert.push([id,safeSheetLiteral_(nama)]);
    }
    if(insert.length)sheet.getRange(sheet.getLastRow()+1,1,insert.length,2).setNumberFormat('@').setValues(insert);
    return {success:true,count:insert.length,skipped:skipped};
  } catch(error) {return {success:false,message:error.message};}
  finally {lock.releaseLock();}
}

function getAllKelas_() {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Daftar_Kelas');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const res = [];
  for (let i = 1; i < data.length; i++) {
    res.push({
      id: SecurityService.sanitizeData(data[i][0]),
      nama: SecurityService.sanitizeData(data[i][1])
    });
  }
  return res;
}

function saveKelas_(idLama, dataKelas) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, 'Daftar_Kelas', ['ID Kelas', 'Nama Kelas']);
  const data = sheet.getDataRange().getValues();
  
  
  if (idLama) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idLama)) {
        sheet.getRange(i + 1, 1, 1, 2).setValues([[dataKelas.id, dataKelas.nama]]);
        return { success: true };
      }
    }
    return { success: false, message: 'Kelas tidak ditemukan' };
  } else {
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(dataKelas.id)) {
        return { success: false, message: 'ID Kelas sudah ada' };
      }
    }
    sheet.appendRow([dataKelas.id, dataKelas.nama]);
    return { success: true };
  }
}

function deleteKelas_(id) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Daftar_Kelas');
  if (!sheet) return { success: false, message: 'Sheet tidak ditemukan' };
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: 'Kelas tidak ditemukan' };
}


function getAllMapel_() {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Daftar_Mapel');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const res = [];
  for (let i = 1; i < data.length; i++) {
    res.push({
      id: SecurityService.sanitizeData(data[i][0]),
      nama: SecurityService.sanitizeData(data[i][1])
    });
  }
  return res;
}

function saveMapel_(idLama, dataMapel) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, 'Daftar_Mapel', ['ID Mapel', 'Nama Mapel']);
  const data = sheet.getDataRange().getValues();
  
  
  if (idLama) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idLama)) {
        sheet.getRange(i + 1, 1, 1, 2).setValues([[dataMapel.id, dataMapel.nama]]);
        return { success: true };
      }
    }
    return { success: false, message: 'Mata pelajaran tidak ditemukan' };
  } else {
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(dataMapel.id)) {
        return { success: false, message: 'ID Mapel sudah ada' };
      }
    }
    sheet.appendRow([dataMapel.id, dataMapel.nama]);
    return { success: true };
  }
}

function deleteMapel_(id) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Daftar_Mapel');
  if (!sheet) return { success: false, message: 'Sheet tidak ditemukan' };
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: 'Mata pelajaran tidak ditemukan' };
}



function getUjianConfig_() {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Config');
  const data = sheet.getDataRange().getValues();
  let conf = {};
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'ujian_aktif') conf.aktif = (data[i][1] === 'true' || data[i][1] === true);
    if (data[i][0] === 'durasi_menit') conf.durasi = parseInt(data[i][1], 10);
    if (data[i][0] === 'token_harian') conf.token = SecurityService.sanitizeData(String(data[i][1]));
    if (data[i][0] === 'kelas_diizinkan') conf.kelas_diizinkan = SecurityService.sanitizeData(String(data[i][1]));
    if (data[i][0] === 'acak_soal') conf.acak_soal = (String(data[i][1]).toLowerCase() === 'true');
    if (data[i][0] === 'waktu_mulai') conf.waktu_mulai = SecurityService.sanitizeData(String(data[i][1]));
    if (data[i][0] === 'waktu_selesai') conf.waktu_selesai = SecurityService.sanitizeData(String(data[i][1]));
    if (data[i][0] === 'nama_ujian') conf.nama_ujian = SecurityService.sanitizeData(String(data[i][1]));
    if (data[i][0] === 'mapel_ujian') conf.mapel_ujian = SecurityService.sanitizeData(String(data[i][1]));
    if (data[i][0] === 'paket_ujian') conf.paket_ujian = SecurityService.sanitizeData(String(data[i][1]));
    if (data[i][0] === 'logo_url') conf.logo_url = SecurityService.sanitizeData(String(data[i][1]));
  }
  return conf;
}

function setUjianConfig_(c) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Config');
  const data = sheet.getDataRange().getValues();

  const keyFound = { aktif: false, durasi: false, token: false, kelas_diizinkan: false, acak_soal: false, waktu_mulai: false, waktu_selesai: false, nama_ujian: false, mapel_ujian: false, paket_ujian: false, logo_url: false };
  const batchUpdates = [];

  for (let i = 0; i < data.length; i++) {
    
    if (data[i][0] === 'aktif' || data[i][0] === 'ujian_aktif') {
      batchUpdates.push({ row: i + 1, col: 2, value: String(c.aktif) });
      keyFound.aktif = true;
    }
    
    if (data[i][0] === 'durasi_menit') {
      batchUpdates.push({ row: i + 1, col: 2, value: String(c.durasi) });
      keyFound.durasi = true;
    }
    if (data[i][0] === 'token_harian') {
      batchUpdates.push({ row: i + 1, col: 2, value: String(c.token).toUpperCase() });
      keyFound.token = true;
    }
    if (data[i][0] === 'kelas_diizinkan') {
      const kelasVal = c.kelas_diizinkan !== undefined ? String(c.kelas_diizinkan) : '';
      batchUpdates.push({ row: i + 1, col: 2, value: kelasVal });
      keyFound.kelas_diizinkan = true;
    }
    if (data[i][0] === 'acak_soal') {
      const acakSoalVal = c.acak_soal !== undefined ? String(c.acak_soal).toUpperCase() : 'FALSE';
      batchUpdates.push({ row: i + 1, col: 2, value: acakSoalVal });
      keyFound.acak_soal = true;
    }
    if (data[i][0] === 'waktu_mulai') {
      const wMulaiVal = c.waktu_mulai !== undefined ? String(c.waktu_mulai) : '';
      batchUpdates.push({ row: i + 1, col: 2, value: wMulaiVal });
      keyFound.waktu_mulai = true;
    }
    if (data[i][0] === 'waktu_selesai') {
      const wSelesaiVal = c.waktu_selesai !== undefined ? String(c.waktu_selesai) : '';
      batchUpdates.push({ row: i + 1, col: 2, value: wSelesaiVal });
      keyFound.waktu_selesai = true;
    }
    if (data[i][0] === 'nama_ujian') {
      const namaUjianVal = c.nama_ujian !== undefined ? String(c.nama_ujian) : '';
      batchUpdates.push({ row: i + 1, col: 2, value: namaUjianVal });
      keyFound.nama_ujian = true;
    }
    if (data[i][0] === 'mapel_ujian') {
      const mapelUjianVal = c.mapel_ujian !== undefined ? String(c.mapel_ujian) : '';
      batchUpdates.push({ row: i + 1, col: 2, value: mapelUjianVal });
      keyFound.mapel_ujian = true;
    }
    if (data[i][0] === 'paket_ujian') {
      const paketUjianVal = c.paket_ujian !== undefined ? String(c.paket_ujian) : '';
      batchUpdates.push({ row: i + 1, col: 2, value: paketUjianVal });
      keyFound.paket_ujian = true;
    }
    if (data[i][0] === 'logo_url') {
      const logoUrlVal = c.logo_url !== undefined ? String(c.logo_url) : '';
      batchUpdates.push({ row: i + 1, col: 2, value: logoUrlVal });
      keyFound.logo_url = true;
    }
  }

  const rangeList = batchUpdates.map(function(u) {
    return sheet.getRange(u.row, u.col);
  });
  if (rangeList.length > 0) {
    batchUpdates.forEach(function(u, idx) {
      rangeList[idx].setValue(u.value);
    });
    SpreadsheetApp.flush();
  }

  if (!keyFound.aktif) sheet.appendRow(['ujian_aktif', String(c.aktif)]);
  if (!keyFound.durasi) sheet.appendRow(['durasi_menit', String(c.durasi)]);
  if (!keyFound.token) sheet.appendRow(['token_harian', String(c.token).toUpperCase()]);
  if (!keyFound.kelas_diizinkan) {
    const kelasVal = c.kelas_diizinkan !== undefined ? String(c.kelas_diizinkan) : '';
    sheet.appendRow(['kelas_diizinkan', kelasVal]);
  }
  if (!keyFound.acak_soal) {
    const acakSoalVal = c.acak_soal !== undefined ? String(c.acak_soal).toUpperCase() : 'FALSE';
    sheet.appendRow(['acak_soal', acakSoalVal]);
  }
  if (!keyFound.waktu_mulai) {
    const wMulaiVal = c.waktu_mulai !== undefined ? String(c.waktu_mulai) : '';
    sheet.appendRow(['waktu_mulai', wMulaiVal]);
  }
  if (!keyFound.waktu_selesai) {
    const wSelesaiVal = c.waktu_selesai !== undefined ? String(c.waktu_selesai) : '';
    sheet.appendRow(['waktu_selesai', wSelesaiVal]);
  }
  if (!keyFound.nama_ujian) {
    const namaUjianVal = c.nama_ujian !== undefined ? String(c.nama_ujian) : '';
    sheet.appendRow(['nama_ujian', namaUjianVal]);
  }
  if (!keyFound.mapel_ujian) {
    const mapelUjianVal = c.mapel_ujian !== undefined ? String(c.mapel_ujian) : '';
    sheet.appendRow(['mapel_ujian', mapelUjianVal]);
  }
  if (!keyFound.paket_ujian) {
    const paketUjianVal = c.paket_ujian !== undefined ? String(c.paket_ujian) : '';
    sheet.appendRow(['paket_ujian', paketUjianVal]);
  }
  if (!keyFound.logo_url) {
    const logoUrlVal = c.logo_url !== undefined ? String(c.logo_url) : '';
    sheet.appendRow(['logo_url', logoUrlVal]);
  }

  CacheService.getScriptCache().remove('GLOBAL_CONFIG_CACHE');

  return { success: true, config: getUjianConfig_() };
}


function getStatistikUjian_() {
  const ss = getOrCreateSpreadsheet_();
  const siswa = ss.getSheetByName('Data_Siswa').getLastRow() - 1;
  const soal = ss.getSheetByName('Bank_Soal').getLastRow() - 1;
  const sheetRespon = ss.getSheetByName('Respon_Jawaban');
  const lastRow = sheetRespon.getLastRow();

  let belumKoreksi = 0;
  let responCountValid = 0;

  if (lastRow > 1) {
    const responData = sheetRespon.getRange(2, 2, lastRow - 1, 6).getValues();
    for (let i = 0; i < responData.length; i++) {
      if (!responData[i][0]) continue;
      responCountValid++;
      if (responData[i][5] === 'Belum Dikoreksi') belumKoreksi++;
    }
  }

  return {
    totalSiswa: Math.max(0, siswa),
    totalSoal: Math.max(0, soal),
    sudahUjian: Math.max(0, responCountValid),
    belumKoreksi: belumKoreksi
  };
}

function getRekapNilai_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'REKAP_NILAI';
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const ss = getOrCreateSpreadsheet_();
  const sheetRespon = ss.getSheetByName('Respon_Jawaban');
  const sheetSiswa = ss.getSheetByName('Data_Siswa');

  const datRespon = sheetRespon.getDataRange().getValues();
  const datSiswa = sheetSiswa.getDataRange().getValues();

  const mapSiswa = {};
  for (let i = 1; i < datSiswa.length; i++) {
    mapSiswa[String(datSiswa[i][0])] = {
      nama: SecurityService.sanitizeData(datSiswa[i][1]),
      kelas: SecurityService.sanitizeData(datSiswa[i][2])
    };
  }

  const bankSoal = getAllSoal_();
  const mapelAdaEsai = {};
  bankSoal.forEach(s => {
    if (!mapelAdaEsai[s.mapel]) mapelAdaEsai[s.mapel] = false;
    if (s.tipe === 'Esai' || s.tipe === 'Isian Singkat') {
      mapelAdaEsai[s.mapel] = true;
    }
  });

  const rekap = [];
  for (let i = 1; i < datRespon.length; i++) {
    if (!datRespon[i][1]) continue;
    const nisn = SecurityService.sanitizeData(String(datRespon[i][1]));
    const dSiswa = mapSiswa[nisn] || { nama: 'Unknown', kelas: '-' };
    const m = SecurityService.sanitizeData(datRespon[i][9] || '-');

    rekap.push({
      timestamp: datRespon[i][0] ? Utilities.formatDate(new Date(datRespon[i][0]), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm:ss') : '-',
      nisn: nisn,
      nama: dSiswa.nama,
      kelas: dSiswa.kelas,
      skorObjektif: Number(datRespon[i][3]) || 0,
      skorEsai: Number(datRespon[i][4]) || 0,
      nilaiAkhir: Number(datRespon[i][5]) || 0,
      status: SecurityService.sanitizeData(datRespon[i][6] || '-'),
      logP: SecurityService.sanitizeData(datRespon[i][7] || 'Aman'),
      mapel: m,
      adaEsai: mapelAdaEsai[m] || false
    });
  }

  try {
    cache.put(cacheKey, JSON.stringify(rekap), 300);
  } catch (e) {
    Logger.log('Cache put gagal untuk REKAP_NILAI: ' + e.message);
  }

  return rekap;
}

function getJawabanSiswa_(nisn) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ss.getSheetByName('Respon_Jawaban');
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(nisn)) {
      let jawaban = {};
      let detailSkor = {};
      try { jawaban = data[i][2] ? JSON.parse(data[i][2]) : {}; } catch (e) { }
      try { detailSkor = data[i][8] ? JSON.parse(data[i][8]) : {}; } catch (e) { }
      // Apps Script RPC rejects property names ending in double underscores.
      // This ordering metadata is not needed by the correction form.
      delete detailSkor.__urutan_soal__;

      return {
        jawaban: SecurityService.sanitizeData(jawaban),
        detailSkor: SecurityService.sanitizeData(detailSkor)
      };
    }
  }
  return null;
}


function uploadLogoApp_(args) {
  try {
    const dataUrl = String(args && args.fileData || '');
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(dataUrl)) {
      return { success: false, message: 'Data logo tidak valid. Gunakan PNG, JPG, atau WEBP.' };
    }
    // Script Properties membatasi ukuran per nilai; batas dibuat konservatif agar tidak gagal saat disimpan.
    if (dataUrl.length > 8500) {
      return { success: false, message: 'Ukuran logo setelah kompresi melebihi batas. Gunakan logo yang lebih sederhana.' };
    }

    const configurationManager = new ApplicationConfigurationService();
    const saveResult = configurationManager.saveApplicationLogo(dataUrl);
    if (!saveResult || !saveResult.status) {
      return { success: false, message: saveResult && saveResult.message ? saveResult.message : 'Gagal menyimpan logo.' };
    }

    // Sinkronkan juga ke sheet Config agar kompatibel dengan konfigurasi versi lama.
    const ss = getOrCreateSpreadsheet_();
    const sheet = ss.getSheetByName('Config') || getOrCreateSheet_(ss, 'Config', ['Key', 'Value']);
    const rows = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === 'logo_url') {
        sheet.getRange(i + 1, 2).setValue(dataUrl);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow(['logo_url', dataUrl]);
    CacheService.getScriptCache().remove('APP_CONFIG');
    return { success: true, url: dataUrl, message: 'Logo sekolah berhasil disimpan dan diterapkan.' };
  } catch (e) {
    console.error('Gagal menyimpan logo aplikasi: ' + e.message);
    return { success: false, message: e.message || 'Terjadi kesalahan saat menyimpan logo.' };
  }
}

function archiveJawaban_(mapelFilter) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    const ss = getOrCreateSpreadsheet_();
    const sheetRespon = ss.getSheetByName('Respon_Jawaban');
    const sheetArsip = getOrCreateSheet_(ss, 'Arsip_Respon_Jawaban', ['Timestamp', 'ID Siswa', 'Jawaban Mentah', 'Skor Objektif', 'Skor Esai', 'Nilai Akhir', 'Status', 'Log Pelanggaran']);
    
    const dataRespon = sheetRespon.getDataRange().getValues();
    if (dataRespon.length <= 1) {
      return { success: false, message: 'Tidak ada data untuk diarsipkan.' };
    }
    
    const header = dataRespon[0];
    const targetMove = [];
    const targetDeleteRowIndex = [];
    
    for (let i = 1; i < dataRespon.length; i++) {
      if (!dataRespon[i][1]) continue;
      
      const mapelValue = String(dataRespon[i][9] || ''); 
      
      let isMatch = true;
      if (mapelFilter && mapelFilter !== '') {
        isMatch = (mapelValue === mapelFilter);
      }
      
      if (isMatch) {
         
         const rowData = dataRespon[i];
         targetMove.push(rowData);
         targetDeleteRowIndex.push(i + 1); 
      }
    }
    
    if (targetMove.length === 0) {
      return { success: false, message: 'Tidak ada data yang sesuai untuk diarsipkan.' };
    }
    
    
    sheetArsip.getRange(sheetArsip.getLastRow() + 1, 2, targetMove.length, 1).setNumberFormat('@');
    sheetArsip.getRange(sheetArsip.getLastRow() + 1, 1, targetMove.length, targetMove[0].length).setValues(targetMove);
    
    
    
    targetDeleteRowIndex.reverse();
    targetDeleteRowIndex.forEach(function(rowIndex) {
       sheetRespon.deleteRow(rowIndex);
    });
    
    CacheService.getScriptCache().remove('REKAP_NILAI');
    SpreadsheetApp.flush();
    
    return { success: true, message: `Berhasil mengarsipkan ${targetMove.length} data jawaban.` };
  } catch(e) {
    return { success: false, message: 'Gagal mengarsipkan: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}


function unarchiveJawaban_(mapelFilter) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getOrCreateSpreadsheet_();
    const sheetRespon = ss.getSheetByName('Respon_Jawaban');
    const sheetArsip = ss.getSheetByName('Arsip_Respon_Jawaban'); 
    
    if (!sheetArsip) {
      return { success: false, message: 'Sheet arsip tidak ditemukan.' };
    }
    
    const dataArsip = sheetArsip.getDataRange().getValues();
    if (dataArsip.length <= 1) {
      return { success: false, message: 'Tidak ada data arsip untuk dikembalikan.' };
    }
    
    const targetMove = [];
    const targetDeleteRowIndex = [];
    
    for (let i = 1; i < dataArsip.length; i++) {
        if (!dataArsip[i][1]) continue;
        
        const mapelValue = String(dataArsip[i][9] || ''); 
        
        let isMatch = true;
        if (mapelFilter && mapelFilter !== '') {
            isMatch = (mapelValue === mapelFilter);
        }
        
        if (isMatch) {
            targetMove.push(dataArsip[i]);
            targetDeleteRowIndex.push(i + 1);
        }
    }
    
    if (targetMove.length === 0) {
      return { success: false, message: 'Tidak ada data arsip yang sesuai untuk dikembalikan.' };
    }
    
    
    sheetRespon.getRange(sheetRespon.getLastRow() + 1, 2, targetMove.length, 1).setNumberFormat('@');
    sheetRespon.getRange(sheetRespon.getLastRow() + 1, 1, targetMove.length, targetMove[0].length).setValues(targetMove);
    
    
    targetDeleteRowIndex.reverse();
    targetDeleteRowIndex.forEach(function(rowIndex) {
        sheetArsip.deleteRow(rowIndex);
    });
    
    CacheService.getScriptCache().remove('REKAP_NILAI');
    SpreadsheetApp.flush();
    
    return { success: true, message: `Berhasil mengembalikan ${targetMove.length} data jawaban dari arsip.` };
  } catch(e) {
    return { success: false, message: 'Gagal mengembalikan arsip: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}


function getArsipStats_() {
  const ss = getOrCreateSpreadsheet_();
  const sheetArsip = ss.getSheetByName('Arsip_Respon_Jawaban');

  if (!sheetArsip) {
    return { success: true, stats: {} };
  }

  const dataArsip = sheetArsip.getDataRange().getValues();
  if (dataArsip.length <= 1) {
    return { success: true, stats: {} };
  }

  const mapelCount = {};
  for (let i = 1; i < dataArsip.length; i++) {
    if (!dataArsip[i][1]) continue;
    let mapelValue = String(dataArsip[i][9] || 'Tanpa Mata Pelajaran');
    if (mapelValue === '' || mapelValue === '-') {
      mapelValue = 'Tanpa Mata Pelajaran';
    }

    mapelValue = SecurityService.sanitizeData(mapelValue);

    if (!mapelCount[mapelValue]) {
      mapelCount[mapelValue] = 1;
    } else {
      mapelCount[mapelValue]++;
    }
  }

  return { success: true, stats: SecurityService.sanitizeData(mapelCount) };
}
