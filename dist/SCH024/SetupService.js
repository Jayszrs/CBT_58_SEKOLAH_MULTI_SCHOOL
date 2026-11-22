
function getOrCreateSpreadsheet_() {
  const scriptPropertiesObject = PropertiesService.getScriptProperties();
  let spreadsheetIdString = scriptPropertiesObject.getProperty('SPREADSHEET_ID') || getSchoolMetadata_().spreadsheetId;
  let spreadsheetInstance;

  if (spreadsheetIdString) {
    try {
      spreadsheetInstance = SpreadsheetApp.openById(spreadsheetIdString);
      scriptPropertiesObject.setProperty('SPREADSHEET_ID', spreadsheetIdString);
    } catch (systemError) {
      
      
      throw new Error("Gagal membuka database (Spreadsheet). Sistem mungkin sedang sibuk. Detail: " + systemError.message);
    }
  }

  
  if (!spreadsheetIdString) {
    spreadsheetInstance = SpreadsheetApp.create('CBT-' + getSchoolMetadata_().schoolId + ' Database');
    scriptPropertiesObject.setProperty('SPREADSHEET_ID', spreadsheetInstance.getId());
    initializeDatabase(spreadsheetInstance);
  }

  if (scriptPropertiesObject.getProperty('SCHOOL_RESOURCES_VERSION') !== '1') {
    initializeDatabase(spreadsheetInstance);
    scriptPropertiesObject.setProperty('SCHOOL_RESOURCES_VERSION', '1');
  }
  return spreadsheetInstance;
}


function getOrCreateDriveFolder_() {
  const scriptPropertiesObject = PropertiesService.getScriptProperties();
  let folderIdString = scriptPropertiesObject.getProperty('DRIVE_FOLDER_ID') || getSchoolMetadata_().driveFolderId;
  let folderInstance = null;

  if (folderIdString) {
    try {
      folderInstance = DriveApp.getFolderById(folderIdString);
      scriptPropertiesObject.setProperty('DRIVE_FOLDER_ID', folderIdString);
    } catch (systemError) {
      folderIdString = null;
    }
  }

  if (!folderInstance) {
    // Buat folder milik project ini; jangan otomatis memakai folder bernama sama
    // yang mungkin milik aplikasi/project lain.
    folderInstance = DriveApp.createFolder('CBT-' + getSchoolMetadata_().schoolId + ' Media');
    scriptPropertiesObject.setProperty('DRIVE_FOLDER_ID', folderInstance.getId());
  }

  // Folder dan file media tetap private. Siswa melihat gambar melalui fungsi
  // server-side Apps Script yang memeriksa referensi gambar pada Bank_Soal.
  return folderInstance;
}

function getOrCreateSheet_(spreadsheetInstance, sheetNameString, headersArray) {
  let targetSheet = spreadsheetInstance.getSheetByName(sheetNameString);

  if (!targetSheet) {
    targetSheet = spreadsheetInstance.insertSheet(sheetNameString);
    if (headersArray && headersArray.length > 0) {
      targetSheet.appendRow(headersArray);
      targetSheet.setFrozenRows(1);
      targetSheet.getRange(1, 1, 1, headersArray.length).setFontWeight("bold");
    }
  }

  return targetSheet;
}

function initializeFirebaseScriptProperties_() {
  const scriptPropertiesObject = PropertiesService.getScriptProperties();
  const firebaseRequiredPropertiesMap = {
    'FIREBASE_DATABASE_URL': getSchoolMetadata_().firebaseDatabaseUrl || '',
    'FIREBASE_CLIENT_EMAIL': '',
    'FIREBASE_PRIVATE_KEY': ''
  };

  const existingPropertiesObject = scriptPropertiesObject.getProperties();
  const missingPropertyKeysArray = [];

  for (const propertyKeyString in firebaseRequiredPropertiesMap) {
    if (!existingPropertiesObject.hasOwnProperty(propertyKeyString) || !existingPropertiesObject[propertyKeyString]) {
      scriptPropertiesObject.setProperty(propertyKeyString, firebaseRequiredPropertiesMap[propertyKeyString]);
      missingPropertyKeysArray.push(propertyKeyString);
    }
  }

  if (missingPropertyKeysArray.length > 0) {
    console.log(
      'Setup: Script Properties Firebase telah dibuat: ' + missingPropertyKeysArray.join(', ') + '. ' +
      'Silakan isi nilainya di Project Settings > Script Properties sebelum menggunakan sistem.'
    );
  } else {
    console.log('Setup: Semua Script Properties Firebase sudah terkonfigurasi.');
  }
}

function initializeDatabase(spreadsheetInstance) {
  if (!spreadsheetInstance) {
    spreadsheetInstance = getOrCreateSpreadsheet_();
  }

  initializeFirebaseScriptProperties_();
  getOrCreateDriveFolder_();

  getOrCreateSheet_(spreadsheetInstance, 'Bank_Soal', ['ID Soal', 'Tipe', 'Pertanyaan', 'Opsi', 'Kunci Jawaban', 'Bobot', 'URL Gambar', 'Mata Pelajaran', 'Petunjuk', 'Teks Pendukung', 'Opsi Gambar']);
  getOrCreateSheet_(spreadsheetInstance, 'Data_Siswa', ['NISN', 'Nama', 'Kelas', 'Password', 'Status Login']);
  getOrCreateSheet_(spreadsheetInstance, 'Respon_Jawaban', ['Timestamp', 'ID Siswa', 'Jawaban Mentah', 'Skor Objektif', 'Skor Esai', 'Nilai Akhir', 'Status', 'Log Pelanggaran']);
  getOrCreateSheet_(spreadsheetInstance, 'Arsip_Respon_Jawaban', ['Timestamp', 'ID Siswa', 'Jawaban Mentah', 'Skor Objektif', 'Skor Esai', 'Nilai Akhir', 'Status', 'Log Pelanggaran']);
  getOrCreateSheet_(spreadsheetInstance, 'Daftar_Kelas', ['ID Kelas', 'Nama Kelas']);

  
  
  getOrCreateSheet_(spreadsheetInstance, 'Daftar_Mapel', ['ID Mapel', 'Nama Mapel']);
  getOrCreateSheet_(spreadsheetInstance, 'Paket_Soal', ['id_paket', 'nama_paket', 'deskripsi', 'soal_ids', 'dibuat_pada']);

  const configurationSheet = getOrCreateSheet_(spreadsheetInstance, 'Config', ['Key', 'Value']);

  if (configurationSheet.getLastRow() === 1) {
    configurationSheet.appendRow(['ujian_aktif', 'false']);
    configurationSheet.appendRow(['durasi_menit', '60']);
    configurationSheet.appendRow(['token_harian', '']);
    configurationSheet.appendRow(['acak_soal', 'false']);
    configurationSheet.appendRow(['logo_url', '']);
    configurationSheet.appendRow(['allow_password_change', 'true']);
  }

  const defaultSheetOne = spreadsheetInstance.getSheetByName('Sheet1');
  if (defaultSheetOne) {
    spreadsheetInstance.deleteSheet(defaultSheetOne);
  }
}

/** Jalankan satu kali per sekolah memakai akun Google pemilik sekolah itu. */
function setupSchoolResources() {
  const school = getSchoolMetadata_();
  const ss = getOrCreateSpreadsheet_();
  initializeDatabase(ss);
  const folder = getOrCreateDriveFolder_();
  const result = {
    school_id: school.schoolId,
    school_name: school.schoolName,
    account_id: school.accountId,
    firebase_group: school.firebaseGroup,
    spreadsheet_id: ss.getId(),
    spreadsheet_url: ss.getUrl(),
    drive_folder_id: folder.getId(),
    drive_folder_url: folder.getUrl(),
    status: 'RESOURCES_CREATED'
  };
  Logger.log('LINK_SEKOLAH_JSON=' + JSON.stringify(result));
  return result;
}

/** Baca link resource yang sudah dibuat, tanpa membuat resource baru. */
function getSchoolResourceLinks() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  const folderId = props.getProperty('DRIVE_FOLDER_ID');
  return {
    school_id: getSchoolMetadata_().schoolId,
    spreadsheet_url: ssId ? SpreadsheetApp.openById(ssId).getUrl() : '',
    drive_folder_url: folderId ? DriveApp.getFolderById(folderId).getUrl() : ''
  };
}
