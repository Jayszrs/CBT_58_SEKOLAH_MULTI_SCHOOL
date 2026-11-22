class ExamDeliveryService {
  constructor() {
    this.spreadsheetInstance = getOrCreateSpreadsheet_();
    this.configurationSheet = this.spreadsheetInstance.getSheetByName('Config');
  }

  retrieveQuestionsForStudent(subjectFilterString, packageIdString) {
    
    let allQuestionsArray = getAllSoal_(!!packageIdString);
    
    if (packageIdString && packageIdString !== '' && packageIdString !== 'undefined') {
      const allPackages = getAllPaketSoal_(true);
      const targetPackage = allPackages.find(p => String(p.id_paket) === String(packageIdString));
      
      if (targetPackage && targetPackage.soal_ids) {
        
        const packageSoalIds = targetPackage.soal_ids.map(id => String(id));
        allQuestionsArray = allQuestionsArray.filter(q => packageSoalIds.includes(String(q.id)));
      }
    } else if (subjectFilterString && subjectFilterString !== '' && subjectFilterString !== 'undefined') {
      allQuestionsArray = allQuestionsArray.filter(function (questionObject) {
        return SecurityService.restoreDisplayText(questionObject.mapel) === String(subjectFilterString);
      });
    }

    const formattedStudentQuestionsArray = allQuestionsArray.map(function (questionObject) {
      return {
        id: questionObject.id,
        tipe: questionObject.tipe,
        pertanyaan: questionObject.pertanyaan,
        petunjuk: questionObject.petunjuk || '',
        teks_pendukung: questionObject.teks_pendukung || '',
        opsi: questionObject.opsi,
        opsi_gambar: questionObject.opsi_gambar || [],
        bobot: questionObject.bobot,
        url_gambar: questionObject.url_gambar,
        mapel: questionObject.mapel
      };
    });
    return formattedStudentQuestionsArray;
  }

  executeExamStart(nisnString) {
    const studentAuthenticationManagerInstance = new StudentAuthenticationService();
    if (!studentAuthenticationManagerInstance.verifySession(nisnString)) {
      return { success: false, message: 'Sesi tidak valid.' };
    }

    const configurationDataMatrix = this.configurationSheet.getDataRange().getValues();

    let examDurationMinutes = 60;
    let isQuestionRandomized = false;
    let examStartTimeString = '';
    let examEndTimeString = '';
    let examNameString = '';
    let examSubjectString = '';
    let examPackageIdString = '';
    for (let index = 0; index < configurationDataMatrix.length; index++) {
      const configurationKey = configurationDataMatrix[index][0];
      const configurationValue = configurationDataMatrix[index][1];

      if (configurationKey === 'durasi_menit') {
        examDurationMinutes = parseInt(configurationValue, 10) || 60;
      }
      if (configurationKey === 'acak_soal') {
        isQuestionRandomized = (String(configurationValue).toLowerCase() === 'true');
      }
      if (configurationKey === 'waktu_mulai') {
        examStartTimeString = String(configurationValue);
      }
      if (configurationKey === 'waktu_selesai') {
        examEndTimeString = String(configurationValue);
      }
      if (configurationKey === 'nama_ujian') {
        examNameString = String(configurationValue);
      }
      if (configurationKey === 'mapel_ujian') {
        examSubjectString = String(configurationValue);
      }
      if (configurationKey === 'paket_ujian') {
        examPackageIdString = String(configurationValue);
      }
    }

    const currentServerTimeMilliseconds = new Date().getTime();
    if (examStartTimeString) {
      const parsedStartTimeMilliseconds = new Date(examStartTimeString).getTime();
      if (!isNaN(parsedStartTimeMilliseconds) && currentServerTimeMilliseconds < parsedStartTimeMilliseconds) {
        return { success: false, message: 'Gagal memulai. Ujian belum dimulai.' };
      }
    }

    if (examEndTimeString) {
      const parsedEndTimeMilliseconds = new Date(examEndTimeString).getTime();
      if (!isNaN(parsedEndTimeMilliseconds) && currentServerTimeMilliseconds > parsedEndTimeMilliseconds) {
        return { success: false, message: 'Gagal memulai. Waktu ujian telah berakhir.' };
      }
    }

    return {
      success: true,
      data: {
        namaUjian: examNameString,
        soal: this.retrieveQuestionsForStudent(examSubjectString, examPackageIdString),
        durasiMenit: examDurationMinutes,
        serverTime: currentServerTimeMilliseconds,
        acakSoal: isQuestionRandomized
      }
    };
  }

  getCurrentServerTimeMilliseconds() {
    return new Date().getTime();
  }
}

class ExamAutoSaveService {
  constructor() {
    this.scriptCacheMemory = CacheService.getScriptCache();
    this.firebaseDatabaseInstance = new FirebaseDatabaseService();
  }

  executeTemporarySave(nisnString, rawAnswerJsonString) {
    try {
      const normalizedNisn = String(nisnString == null ? '' : nisnString).trim();
      if (!normalizedNisn || !rawAnswerJsonString) {
        return { success: false, message: 'Data autosave tidak lengkap.' };
      }

      // Hanya sesi ujian yang masih aktif yang boleh mengirim autosave.
      const sessionResponse = this.firebaseDatabaseInstance.readData('sesi_siswa/' + normalizedNisn);
      if (!sessionResponse.success || !sessionResponse.data || sessionResponse.data.status !== 'Aktif') {
        return { success: false, message: 'Sesi ujian tidak aktif.' };
      }

      const currentServerTimeMilliseconds = new Date().getTime();
      const memoryCacheKeyString = 'AUTOSAVE_' + normalizedNisn;
      const throttleCacheKeyString = 'LAST_FIREBASE_SAVE_' + normalizedNisn;
      if (rawAnswerJsonString.length <= 90000) this.scriptCacheMemory.put(memoryCacheKeyString, rawAnswerJsonString, 21600);

      const lastFirebaseSaveTimeString = this.scriptCacheMemory.get(throttleCacheKeyString);
      let shouldPushToFirebase = false;
      if (!lastFirebaseSaveTimeString) {
        shouldPushToFirebase = true;
      } else {
        const lastFirebaseSaveTimeMilliseconds = parseInt(lastFirebaseSaveTimeString, 10);
        shouldPushToFirebase = currentServerTimeMilliseconds - lastFirebaseSaveTimeMilliseconds > 60000;
      }

      if (shouldPushToFirebase) {
        const targetFirebasePathString = 'autosave_jawaban_berjalan/' + normalizedNisn;
        const firebasePayloadObject = {
          jawaban_terakhir: rawAnswerJsonString,
          waktu_pembaruan: currentServerTimeMilliseconds
        };
        const saveResponse = this.firebaseDatabaseInstance.patchData(targetFirebasePathString, firebasePayloadObject);
        if (!saveResponse.success) {
          return { success: false, message: 'Autosave belum tersinkron ke server.' };
        }
        this.scriptCacheMemory.put(throttleCacheKeyString, currentServerTimeMilliseconds.toString(), 21600);
      }

      return { success: true };
    } catch (systemError) {
      console.error('Kritis: Gagal mengeksekusi autosave memori/Firebase. Detail: ' + systemError.message);
      return { success: false, message: 'Gagal menyimpan jawaban sementara.' };
    }
  }
}

class ExamSubmissionService {
  constructor() {
    this.firebaseDatabaseInstance = new FirebaseDatabaseService();
    this.spreadsheetInstance = getOrCreateSpreadsheet_();
    this.configurationSheet = this.spreadsheetInstance.getSheetByName('Config');
    this.scriptCacheMemory = CacheService.getScriptCache();
  }

  fetchActiveConfiguration() {
    const cachedConfigString = this.scriptCacheMemory.get('GLOBAL_CONFIG_CACHE');
    if (cachedConfigString) {
      return JSON.parse(cachedConfigString);
    }

    const configData = {};
    const dataMatrix = this.configurationSheet.getDataRange().getValues();
    for (let index = 0; index < dataMatrix.length; index++) {
      configData[dataMatrix[index][0]] = dataMatrix[index][1];
    }

    this.scriptCacheMemory.put('GLOBAL_CONFIG_CACHE', JSON.stringify(configData), 21600);
    return configData;
  }

  executeFinalSubmission(nisnString, rawAnswerJsonString, violationLogString, rawQuestionOrderJsonString) {
    const studentAuthenticationManagerInstance = new StudentAuthenticationService();
    if (!studentAuthenticationManagerInstance.verifySession(nisnString)) {
      return { success: false, message: 'Sesi tidak valid.' };
    }

    let questionBankArray = getAllSoal_();
    let parsedStudentAnswersObject = {};

    try {
      parsedStudentAnswersObject = JSON.parse(rawAnswerJsonString);
    } catch (jsonError) {
      return { success: false, message: 'Format jawaban tidak valid.' };
    }

    const activeConfiguration = this.fetchActiveConfiguration();

    if (activeConfiguration && activeConfiguration.paket_ujian) {
      const allPackages = getAllPaketSoal_();
      const targetPackage = allPackages.find(p => p.id_paket === activeConfiguration.paket_ujian);
      if (targetPackage && targetPackage.soal_ids && targetPackage.soal_ids.length > 0) {
        questionBankArray = questionBankArray.filter(q => targetPackage.soal_ids.includes(q.id));
      }
    } else if (activeConfiguration && activeConfiguration.mapel_ujian) {
      questionBankArray = questionBankArray.filter(function (questionObject) {
        return SecurityService.restoreDisplayText(questionObject.mapel) === activeConfiguration.mapel_ujian;
      });
    }

    const gradingResultObject = autoGrade(parsedStudentAnswersObject, questionBankArray);
    // Urutan client hanya untuk kesesuaian nomor soal pada cetak individu, tidak digunakan menilai.
    if (rawQuestionOrderJsonString) {
      try {
        const order = JSON.parse(rawQuestionOrderJsonString);
        const validIds = new Set(questionBankArray.map(q => String(q.id)));
        if (Array.isArray(order) && order.length === validIds.size &&
            order.every(id => validIds.has(String(id))) && new Set(order.map(String)).size === validIds.size) {
          gradingResultObject.detailSkor.__urutan_soal__ = order.map(String);
        }
      } catch (ignore) { /* Fallback urutan bank soal untuk client versi lama. */ }
    }
    const correctionStatusString = gradingResultObject.butuhKoreksiEsai ? 'Belum Dikoreksi' : 'Selesai';
    
    let activeSubjectValueString = '-';
    if (activeConfiguration && activeConfiguration.paket_ujian) {
      const allPackages = getAllPaketSoal_();
      const targetPackage = allPackages.find(p => p.id_paket === activeConfiguration.paket_ujian);
      activeSubjectValueString = targetPackage ? ('Paket: ' + targetPackage.nama_paket) : 'Paket Tidak Ditemukan';
    } else if (activeConfiguration && activeConfiguration.mapel_ujian) {
      activeSubjectValueString = activeConfiguration.mapel_ujian;
    }

    const timestampFormatString = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const finalViolationLogString = violationLogString || 'Aman';

    try {
      const targetFinalFirebasePathString = 'rekapan_hasil_ujian/' + nisnString;
      const finalFirebasePayloadObject = {
        waktu_submit: timestampFormatString,
        nisn_siswa: nisnString,
        jawaban_lengkap: rawAnswerJsonString,
        skor_objektif: gradingResultObject.skorObjektif,
        skor_esai: 0,
        nilai_akhir: gradingResultObject.nilaiAkhir,
        detail_skor: gradingResultObject.detailSkor || {},
        status_koreksi: correctionStatusString,
        log_pelanggaran: finalViolationLogString,
        mata_pelajaran: activeSubjectValueString
      };

      const durableSave = this.firebaseDatabaseInstance.patchData(targetFinalFirebasePathString, finalFirebasePayloadObject);
      if (!durableSave.success) return {success:false,message:'Jawaban belum tersimpan di server. Silakan kirim ulang.'};
      this.firebaseDatabaseInstance.writeData('autosave_jawaban_berjalan/' + nisnString, null);
      
      
      this.firebaseDatabaseInstance.patchData('sesi_siswa/' + nisnString, { status: 'Selesai' });

      this.scriptCacheMemory.remove('AUTOSAVE_' + nisnString);
      this.scriptCacheMemory.remove('LAST_FIREBASE_SAVE_' + nisnString);

      console.log('Log Keamanan: Data ujian akhir berhasil diunggah ke Firebase untuk NISN: ' + nisnString);
    } catch (systemError) {
      console.error('Kritis: Gagal mencadangkan ujian akhir ke Firebase. Detail: ' + systemError.message);
    }

    let submissionRetryCount = 0;
    let isSheetWriteSuccessful = false;
    const maximumRetryLimit = 1;

    while (submissionRetryCount < maximumRetryLimit && !isSheetWriteSuccessful) {
      const systemDatabaseLock = LockService.getScriptLock();
      try {
        systemDatabaseLock.waitLock(1500);

        const responseDatabaseSheet = this.spreadsheetInstance.getSheetByName('Respon_Jawaban');
        const responseRow = responseDatabaseSheet.getLastRow() + 1;
        responseDatabaseSheet.getRange(responseRow, 2).setNumberFormat('@');
        responseDatabaseSheet.getRange(responseRow, 1, 1, 10).setValues([[
          new Date(),
          safeSheetLiteral_(nisnString),
          rawAnswerJsonString,
          gradingResultObject.skorObjektif,
          0,
          gradingResultObject.nilaiAkhir,
          correctionStatusString,
          safeSheetLiteral_(finalViolationLogString),
          JSON.stringify(gradingResultObject.detailSkor || {}),
          activeSubjectValueString
        ]]);

        const studentDataSheet = this.spreadsheetInstance.getSheetByName('Data_Siswa');
        
        const targetStudentCellObject = studentDataSheet.createTextFinder(nisnString).matchEntireCell(true).findNext();
        if (targetStudentCellObject) {
          studentDataSheet.getRange(targetStudentCellObject.getRow(), 5).setValue('Selesai');
        }

        this.scriptCacheMemory.remove('REKAP_NILAI');
        this.scriptCacheMemory.remove('DATA_SISWA');

        isSheetWriteSuccessful = true;
        console.log('Log Keamanan: Transaksi penyelesaian ujian di Sheets berhasil untuk NISN: ' + nisnString);

        return {
          success: true,
          message: 'Ujian berhasil diselesaikan.',
          butuhKoreksiEsai: gradingResultObject.butuhKoreksiEsai,
          nilaiAkhir: gradingResultObject.nilaiAkhir,
          skorObjektif: gradingResultObject.skorObjektif,
          totalSoal: questionBankArray.length
        };
      } catch (lockError) {
        submissionRetryCount++;
        console.error('Peringatan: Antrean Sheets penuh, melepaskan koneksi untuk performa server. Detail: ' + lockError.message);
      } finally {
        systemDatabaseLock.releaseLock();
      }
    }

    return {
      success: true,
      message: 'Server Sheets sedang padat. Namun jangan khawatir, jawaban Anda telah BERHASIL tersimpan dengan aman di server utama Firebase kami.',
      butuhKoreksiEsai: gradingResultObject.butuhKoreksiEsai,
      nilaiAkhir: gradingResultObject.nilaiAkhir,
      skorObjektif: gradingResultObject.skorObjektif,
      totalSoal: questionBankArray.length
    };
  }
}

function getSoalForStudent_(mapelFilter, packageId) {
  const examDeliveryManagerInstance = new ExamDeliveryService();
  return examDeliveryManagerInstance.retrieveQuestionsForStudent(mapelFilter, packageId);
}

function startUjian(nisn, sessionToken) {
  if (!verifyStudentCredential_(nisn, sessionToken)) return invalidStudentSession_();
  const examDeliveryManagerInstance = new ExamDeliveryService();
  return examDeliveryManagerInstance.executeExamStart(nisn);
}

function pingSimpanJawaban(nisn, jawabanJson, sessionToken) {
  if (!verifyStudentCredential_(nisn, sessionToken)) return invalidStudentSession_();
  if (typeof jawabanJson !== 'string' || jawabanJson.length > 200000) return {success:false,message:'Ukuran jawaban tidak valid.'};
  const examAutoSaveManagerInstance = new ExamAutoSaveService();
  return examAutoSaveManagerInstance.executeTemporarySave(nisn, jawabanJson);
}

function submitUjian(nisn, jawabanJson, logPelanggaran, urutanSoalJson, sessionToken) {
  if (!verifyStudentCredential_(nisn, sessionToken)) return invalidStudentSession_();
  if (typeof jawabanJson !== 'string' || jawabanJson.length > 200000 || String(logPelanggaran || '').length > 20000 || String(urutanSoalJson || '').length > 50000) return {success:false,message:'Ukuran kiriman ujian tidak valid.'};
  const examSubmissionManagerInstance = new ExamSubmissionService();
  return examSubmissionManagerInstance.executeFinalSubmission(nisn, jawabanJson, logPelanggaran, urutanSoalJson);
}

function getServerTime() {
  return Date.now();
}
