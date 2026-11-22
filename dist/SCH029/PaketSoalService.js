
function getAllPaketSoal_(bypassCache = false) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PAKET_SOAL_DATA';

  if (!bypassCache) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  }

  const ss = getOrCreateSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, 'Paket_Soal', ['id_paket', 'nama_paket', 'deskripsi', 'soal_ids', 'dibuat_pada']);
  
  const data = sheet.getDataRange().getValues();
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    let parsedSoalIds = [];
    try {
      if (data[i][3]) parsedSoalIds = JSON.parse(data[i][3]);
    } catch (e) {
      parsedSoalIds = [];
    }
    
    let tglRaw = data[i][4];
    let tglIndo = "";
    if (tglRaw instanceof Date) {
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      tglIndo = days[tglRaw.getDay()] + ', ' + tglRaw.getDate() + ' ' + months[tglRaw.getMonth()] + ' ' + tglRaw.getFullYear() + ' ' + 
                Utilities.formatDate(tglRaw, Session.getScriptTimeZone(), 'HH:mm');
    } else {
      tglIndo = String(tglRaw || '-');
    }
    
    result.push({
      id_paket: SecurityService.sanitizeData(String(data[i][0])),
      nama_paket: SecurityService.sanitizeData(String(data[i][1])),
      deskripsi: SecurityService.sanitizeData(String(data[i][2])),
      soal_ids: parsedSoalIds,
      dibuat_pada: SecurityService.sanitizeData(tglIndo)
    });
  }

  cache.put(cacheKey, JSON.stringify(result), 3600);
  return result;
}

function createPaketSoal_(dataPaket) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getOrCreateSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, 'Paket_Soal', ['id_paket', 'nama_paket', 'deskripsi', 'soal_ids', 'dibuat_pada']);
    
    const idPaket = 'PKT_' + new Date().getTime();
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    
    sheet.appendRow([
      idPaket,
      dataPaket.nama_paket,
      dataPaket.deskripsi || '',
      JSON.stringify(dataPaket.soal_ids || []),
      timestamp
    ]);
    
    CacheService.getScriptCache().remove('PAKET_SOAL_DATA');
    return { success: true, message: 'Paket soal berhasil dibuat.', id_paket: idPaket };
  } catch (e) {
    return { success: false, message: 'Gagal membuat paket: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

function updatePaketSoal_(idPaket, dataPaket) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getOrCreateSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, 'Paket_Soal', ['id_paket', 'nama_paket', 'deskripsi', 'soal_ids', 'dibuat_pada']);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idPaket)) {
        const row = i + 1;
        sheet.getRange(row, 2, 1, 3).setValues([[
          dataPaket.nama_paket,
          dataPaket.deskripsi || '',
          JSON.stringify(dataPaket.soal_ids || [])
        ]]);
        
        CacheService.getScriptCache().remove('PAKET_SOAL_DATA');
        return { success: true, message: 'Paket soal berhasil diperbarui.' };
      }
    }
    return { success: false, message: 'Paket tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal memperbarui paket: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

function deletePaketSoal_(idPaket) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getOrCreateSpreadsheet_();
    
    
    const configSheet = ss.getSheetByName('Config');
    const configData = configSheet.getDataRange().getValues();
    for (let i = 0; i < configData.length; i++) {
      if (configData[i][0] === 'paket_ujian' && String(configData[i][1]) === String(idPaket)) {
        return { success: false, message: 'Paket tidak bisa dihapus karena sedang digunakan dalam pengaturan ujian aktif.' };
      }
    }
    
    const sheet = ss.getSheetByName('Paket_Soal');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idPaket)) {
        sheet.deleteRow(i + 1);
        CacheService.getScriptCache().remove('PAKET_SOAL_DATA');
        return { success: true, message: 'Paket soal berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Paket tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus paket: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}
