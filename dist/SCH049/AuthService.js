class StudentAuthenticationService {
  constructor() {
    this.spreadsheetInstance = getOrCreateSpreadsheet_();
    this.configurationSheet = this.spreadsheetInstance.getSheetByName('Config');
    this.studentDataSheet = this.spreadsheetInstance.getSheetByName('Data_Siswa');
    this.firebaseDatabaseInstance = new FirebaseDatabaseService();
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

  executeLogin(nisnNumber, authenticationToken) {
    const activeConfiguration = this.fetchActiveConfiguration();

    const isExamActive = (activeConfiguration['ujian_aktif'] === 'true' || activeConfiguration['ujian_aktif'] === true);
    const validDailyToken = activeConfiguration['token_harian'] || '';
    const allowedClassesConfiguration = String(activeConfiguration['kelas_diizinkan'] || '').trim();
    const examStartTimeString = String(activeConfiguration['waktu_mulai'] || '');
    const examEndTimeString = String(activeConfiguration['waktu_selesai'] || '');

    if (!isExamActive) {
      return { success: false, message: 'Ujian sedang tidak aktif.' };
    }

    const currentTimeMilliseconds = new Date().getTime();

    if (examStartTimeString) {
      const parsedStartTimeMilliseconds = new Date(examStartTimeString).getTime();
      if (!isNaN(parsedStartTimeMilliseconds) && currentTimeMilliseconds < parsedStartTimeMilliseconds) {
        return { success: false, message: 'Gagal login. Ujian belum dimulai.' };
      }
    }

    if (examEndTimeString) {
      const parsedEndTimeMilliseconds = new Date(examEndTimeString).getTime();
      if (!isNaN(parsedEndTimeMilliseconds) && currentTimeMilliseconds > parsedEndTimeMilliseconds) {
        return { success: false, message: 'Gagal login. Waktu ujian telah berakhir.' };
      }
    }

    let allowedClassesArray = [];
    if (allowedClassesConfiguration.length > 0) {
      allowedClassesArray = allowedClassesConfiguration.split(',').map(function (className) {
        return className.trim().toLowerCase();
      }).filter(function (className) {
        return className.length > 0;
      });
    }

    
    const targetStudentCellObject = this.studentDataSheet.createTextFinder(String(nisnNumber)).matchEntireCell(true).findNext();

    if (!targetStudentCellObject) {
      return { success: false, message: 'NISN tidak ditemukan.' };
    }

    const studentRowIndex = targetStudentCellObject.getRow();
    const studentRowData = this.studentDataSheet.getRange(studentRowIndex, 1, 1, 4).getValues()[0];

    const individualPassword = String(studentRowData[3] == null ? '' : studentRowData[3]).trim();
    const suppliedCredential = String(authenticationToken == null ? '' : authenticationToken).trim();
    const matchesIndividualPassword = !!individualPassword && suppliedCredential === individualPassword;
    const matchesDailyToken = !!validDailyToken && suppliedCredential.toUpperCase() === String(validDailyToken).toUpperCase();
    if (!matchesIndividualPassword && !matchesDailyToken) {
      return { success: false, message: 'Password akun atau token ujian tidak valid.' };
    }

    const currentStudentData = {
      nisn: String(studentRowData[0]),
      nama: String(studentRowData[1]),
      kelas: String(studentRowData[2])
    };

    if (allowedClassesArray.length > 0) {
      const currentStudentClass = currentStudentData.kelas.trim().toLowerCase();
      if (!allowedClassesArray.includes(currentStudentClass)) {
        return { success: false, message: 'Gagal login. Jadwal ujian bukan untuk kelas Anda saat ini.' };
      }
    }

    const sessionPathString = 'sesi_siswa/' + currentStudentData.nisn;
    const firebaseSessionResponse = this.firebaseDatabaseInstance.readData(sessionPathString);

    if (firebaseSessionResponse.success && firebaseSessionResponse.data) {
      const currentStudentStatus = firebaseSessionResponse.data.status;
      if (currentStudentStatus === 'Aktif') {
        return { success: false, message: 'Akun sedang digunakan di perangkat lain.' };
      }

      if (currentStudentStatus === 'Selesai') {
        return { success: false, message: 'Anda sudah menyelesaikan ujian ini.' };
      }
    }

    const sessionUpdatePayloadObject = {
      status: 'Aktif',
      waktu_login: new Date().getTime(),
      nama_siswa: currentStudentData.nama
    };
    const updateSessionResponse = this.firebaseDatabaseInstance.patchData(sessionPathString, sessionUpdatePayloadObject);

    if (!updateSessionResponse.success) {
      console.error('Kritis: Gagal memperbarui status sesi ke Firebase untuk NISN: ' + currentStudentData.nisn);
      return { success: false, message: 'Terjadi gangguan koneksi ke server. Silakan coba lagi.' };
    }

    
    try {
      this.studentDataSheet.getRange(studentRowIndex, 5).setValue('Aktif');
      this.scriptCacheMemory.remove('DATA_SISWA');
    } catch (e) {
      console.error('Peringatan: Gagal sinkronisasi status ke Spreadsheet: ' + e.message);
    }

    return {
      success: true,
      data: {
        nisn: SecurityService.sanitizeData(currentStudentData.nisn),
        nama: SecurityService.sanitizeData(currentStudentData.nama),
        kelas: SecurityService.sanitizeData(currentStudentData.kelas)
      }
    };
  }

  executeLogout(nisnNumber) {
    const sessionPathString = 'sesi_siswa/' + String(nisnNumber);
    const sessionUpdatePayloadObject = {
      status: 'Offline',
      waktu_logout: new Date().getTime()
    };
    const updateSessionResponse = this.firebaseDatabaseInstance.patchData(sessionPathString, sessionUpdatePayloadObject);

    if (updateSessionResponse.success) {
      
      try {
        const targetStudentCellObject = this.studentDataSheet.createTextFinder(String(nisnNumber)).matchEntireCell(true).findNext();
        if (targetStudentCellObject) {
          this.studentDataSheet.getRange(targetStudentCellObject.getRow(), 5).setValue('Offline');
          this.scriptCacheMemory.remove('DATA_SISWA');
        }
      } catch (e) {
        console.error('Peringatan: Gagal sinkronisasi status logout ke Spreadsheet: ' + e.message);
      }
      return { success: true };
    } else {
      console.error('Kritis: Gagal memperbarui status logout ke Firebase untuk NISN: ' + nisnNumber);
      return { success: false };
    }
  }

  verifySession(nisnNumber) {
    if (!nisnNumber) {
      return false;
    }

    const sessionPathString = 'sesi_siswa/' + String(nisnNumber);
    const firebaseSessionResponse = this.firebaseDatabaseInstance.readData(sessionPathString);
    if (firebaseSessionResponse.success && firebaseSessionResponse.data) {
      return firebaseSessionResponse.data.status === 'Aktif';
    }

    return false;
  }
}

class AdminAuthenticationService {
  constructor() {
    this.scriptCacheMemory = CacheService.getScriptCache();
    this.scriptSystemProperties = PropertiesService.getScriptProperties();
  }

  checkLoginRateLimitStatus() {
    const cooldownExpirationString = this.scriptCacheMemory.get('ADMIN_LOGIN_COOLDOWN');
    if (cooldownExpirationString) {
      const cooldownExpirationMilliseconds = parseInt(cooldownExpirationString, 10);
      const currentTimeMilliseconds = new Date().getTime();
      if (currentTimeMilliseconds < cooldownExpirationMilliseconds) {
        const remainingCooldownSeconds = Math.ceil((cooldownExpirationMilliseconds - currentTimeMilliseconds) / 1000);
        return { success: false, status: 'rate_limited', remaining: remainingCooldownSeconds };
      } else {
        this.scriptCacheMemory.remove('ADMIN_LOGIN_COOLDOWN');
        this.scriptCacheMemory.remove('ADMIN_LOGIN_FAILED_ATTEMPTS');
      }
    }
    return { success: true, status: 'ready' };
  }

  _hashPassword(inputString) {
    if (!inputString) return '';
    const hashByteArray = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inputString);
    return hashByteArray.map(function (byteValue) {
      return (byteValue < 0 ? byteValue + 256 : byteValue).toString(16).padStart(2, '0');
    }).join('');
  }

  executeLogin(providedPasswordString) {
    const rateLimitVerificationStatus = this.checkLoginRateLimitStatus();
    if (!rateLimitVerificationStatus.success && rateLimitVerificationStatus.status === 'rate_limited') {
      const remainingMinutesBlock = Math.ceil(rateLimitVerificationStatus.remaining / 60);
      return { success: false, message: `Login diblokir sementara. Coba lagi dalam ${remainingMinutesBlock} menit.` };
    }

    const providedPasswordHash = this._hashPassword(providedPasswordString);
    const sessionIdentifierKeyString = 'ADMIN_SESSION_' + providedPasswordHash;
    let storedAdminPassword = this.scriptSystemProperties.getProperty('ADMIN_PASSWORD');
    if (!storedAdminPassword) {
      return {
        success: false,
        message: 'Password administrator belum dikonfigurasi. Isi ADMIN_PASSWORD pada Script Properties terlebih dahulu.'
      };
    }

    // Auto-migration: Jika password tersimpan masih berupa plain text (panjang < 64 untuk SHA-256 hex)
    if (storedAdminPassword.length < 64) {
      const migratedHash = this._hashPassword(storedAdminPassword);
      this.scriptSystemProperties.setProperty('ADMIN_PASSWORD', migratedHash);
      storedAdminPassword = migratedHash;
      console.log('Sistem: Password admin berhasil dimigrasi ke format hash SHA-256.');
    }

    if (providedPasswordHash === storedAdminPassword) {
      this.scriptCacheMemory.put(sessionIdentifierKeyString, 'valid', 1800);
      this.scriptCacheMemory.remove('ADMIN_LOGIN_FAILED_ATTEMPTS');
      return { success: true };
    }

    let currentFailedAttemptsCount = parseInt(this.scriptCacheMemory.get('ADMIN_LOGIN_FAILED_ATTEMPTS') || '0', 10);
    currentFailedAttemptsCount++;
    if (currentFailedAttemptsCount >= 5) {
      const nextCooldownExpirationMilliseconds = new Date().getTime() + (3 * 60 * 1000);
      this.scriptCacheMemory.put('ADMIN_LOGIN_COOLDOWN', nextCooldownExpirationMilliseconds.toString(), 180);
      this.scriptCacheMemory.put('ADMIN_LOGIN_FAILED_ATTEMPTS', currentFailedAttemptsCount.toString(), 180);
      return { success: false, message: 'Terlalu banyak percobaan gagal. Login diblokir selama 3 menit.', rateLimited: true, reloadNeeded: true };
    } else {
      this.scriptCacheMemory.put('ADMIN_LOGIN_FAILED_ATTEMPTS', currentFailedAttemptsCount.toString(), 3600);
      return { success: false, message: `Password salah. (Percobaan gagal: ${currentFailedAttemptsCount}/5)` };
    }
  }


  executeSuperadminRecovery(providedPasswordString) {
    return {
      success: false,
      message: 'Pemulihan melalui password bawaan dinonaktifkan. Admin harus melakukan reset aman via Apps Script.'
    };
  }

  executePasswordChange(oldPasswordString, newPasswordString) {
    // 1. Cek Konfigurasi Toggle di Spreadsheet
    try {
      const spreadsheet = getOrCreateSpreadsheet_();
      const configSheet = spreadsheet.getSheetByName('Config');
      if (configSheet) {
        const configData = configSheet.getDataRange().getValues();
        let isChangeAllowed = true; // Default true jika key tidak ditemukan
        for (let i = 0; i < configData.length; i++) {
          if (configData[i][0] === 'allow_password_change') {
            isChangeAllowed = (String(configData[i][1]).toLowerCase() === 'true');
            break;
          }
        }
        if (!isChangeAllowed) {
          return { success: false, message: 'Fitur ubah password dinonaktifkan oleh Administrator.' };
        }
      }
    } catch (e) {
      console.error('Gagal memverifikasi konfigurasi allow_password_change:', e.message);
    }

    // 2. Validasi Password Lama
    const storedAdminPassword = this.scriptSystemProperties.getProperty('ADMIN_PASSWORD');
    const oldPasswordHash = this._hashPassword(oldPasswordString);
    
    if (oldPasswordHash !== storedAdminPassword) {
      return { success: false, message: 'Password lama tidak sesuai.' };
    }

    // 3. Simpan Password Baru sebagai Hash
    const newPasswordHash = this._hashPassword(newPasswordString);
    this.scriptSystemProperties.setProperty('ADMIN_PASSWORD', newPasswordHash);
    
    // Bersihkan cache sesi lama agar login ulang diperlukan dengan password baru
    this.scriptCacheMemory.remove('ADMIN_LOGIN_FAILED_ATTEMPTS');
    
    return { success: true, message: 'Password berhasil diubah. Silakan login kembali pada sesi berikutnya.' };
  }
}

function loginSiswa(nisn, currentToken) {
  const studentAuthenticationManagerInstance = new StudentAuthenticationService();
  return studentAuthenticationManagerInstance.executeLogin(nisn, currentToken);
}

function checkAdminLoginStatus() {
  const adminAuthenticationManagerInstance = new AdminAuthenticationService();
  return adminAuthenticationManagerInstance.checkLoginRateLimitStatus();
}

function loginAdmin(password, username) {
  const adminAuthenticationManagerInstance = new AdminAuthenticationService();
  const normalizedUsername = String(username == null ? '' : username).trim().toLowerCase();
  if (normalizedUsername === 'superadmin') {
    return adminAuthenticationManagerInstance.executeSuperadminRecovery(password);
  }
  if (normalizedUsername && normalizedUsername !== 'admin') {
    return { success: false, message: 'Username administrator tidak dikenal.' };
  }
  return adminAuthenticationManagerInstance.executeLogin(password);
}

function changeAdminPassword_(oldPassword, newPassword) {
  const adminAuthenticationManagerInstance = new AdminAuthenticationService();
  return adminAuthenticationManagerInstance.executePasswordChange(oldPassword, newPassword);
}

function logoutSiswa_(nisn) {
  const studentAuthenticationManagerInstance = new StudentAuthenticationService();
  return studentAuthenticationManagerInstance.executeLogout(nisn);
}

function validateSession_(nisn) {
  const studentAuthenticationManagerInstance = new StudentAuthenticationService();
  return studentAuthenticationManagerInstance.verifySession(nisn);
}