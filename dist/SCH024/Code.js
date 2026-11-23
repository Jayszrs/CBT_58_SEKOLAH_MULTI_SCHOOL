class ApplicationConfigurationService {
  constructor() {
    this.scriptProperties = PropertiesService.getScriptProperties();
    this.cache = CacheService.getScriptCache();
  }

  saveApplicationLogo(base64ImageString) {
    try {
      this.scriptProperties.setProperty('APPLICATION_LOGO_BASE64', base64ImageString);
      this.cache.remove('APP_CONFIG'); 
      console.log('Operasi basis data: Logo aplikasi telah diperbarui ke dalam PropertiesService.');
      return {
        status: true,
        message: 'Logo berhasil diperbarui.'
      };
    } catch (error) {
      console.error('Kritis: Gagal menyimpan logo aplikasi. Detail error: ' + error.message);
      return {
        status: false,
        message: 'Terjadi kesalahan sistem saat menyimpan logo.'
      };
    }
  }

  getApplicationLogo() {
    return this.scriptProperties.getProperty('APPLICATION_LOGO_BASE64') || '';
  }

  getGlobalConfiguration() {
    const cachedConfig = this.cache.get('APP_CONFIG');
    if (cachedConfig) {
      console.log('Cache hit: Memuat konfigurasi dari cache.');
      return JSON.parse(cachedConfig);
    }

    let configurationData = {};

    try {
      const spreadsheetInstance = getOrCreateSpreadsheet_();
      const configurationSheet = spreadsheetInstance.getSheetByName('Config');
      const dataMatrix = configurationSheet.getDataRange().getValues();
      for (let index = 0; index < dataMatrix.length; index++) {
        configurationData[dataMatrix[index][0]] = dataMatrix[index][1];
      }
      console.log('Operasi berhasil: Konfigurasi ujian berhasil dimuat.');
    } catch (error) {
      console.error('Peringatan: Gagal memuat konfigurasi. Menggunakan nilai bawaan. Detail error: ' + error.message);
    }

    const config = {
      nama_ujian: configurationData['nama_ujian'] || getSchoolMetadata_().schoolName,
      logo_url: this.getApplicationLogo(),
      applicationLogoData: this.getApplicationLogo()
    };

    try {
      this.cache.put('APP_CONFIG', JSON.stringify(config), 21600); 
    } catch (e) {
      console.warn('Gagal menyimpan cache konfigurasi:', e.message);
    }

    return config;
  }
}

class PostRequestRouter {
  constructor(eventData) {
    this.eventData = eventData;
  }

  processRequest() {
    try {
      if (!this.eventData || !this.eventData.postData || !this.eventData.postData.contents) {
        console.error('Kritis: Payload POST kosong atau tidak valid dari klien.');
        return this.createJsonResponse({ success: false, message: 'Payload tidak valid.' }, 400);
      }

      if (this.eventData.postData.contents.length > 300000) return this.createJsonResponse({success:false,message:'Ukuran permintaan terlalu besar.'},400);
      const requestPayloadObject = JSON.parse(this.eventData.postData.contents);
      const requestedActionString = requestPayloadObject.action;

      if (requestedActionString === 'loginSiswa') {
        const executionResultObject = loginSiswa(requestPayloadObject.nisn, requestPayloadObject.token);
        return this.createJsonResponse(executionResultObject, 200);
      }

      if (requestedActionString === 'submitUjian') {
        const executionResultObject = submitUjian(
          requestPayloadObject.nisn,
          requestPayloadObject.jawaban_mentah,
          requestPayloadObject.log_pelanggaran,
          requestPayloadObject.urutan_soal || '',
          requestPayloadObject.sessionToken
        );
        return this.createJsonResponse(executionResultObject, 200);
      }

      if (requestedActionString === 'simpanJawabanSiswa') {
        const executionResultObject = pingSimpanJawaban(
          requestPayloadObject.nisn,
          requestPayloadObject.jawaban_mentah,
          requestPayloadObject.sessionToken
        );
        return this.createJsonResponse(executionResultObject, 200);
      }

      console.error('Peringatan keamanan: Rute POST tidak ditemukan untuk aksi yang diminta: ' + requestedActionString);
      return this.createJsonResponse({ success: false, message: 'Rute aksi tidak ditemukan pada server.' }, 404);

    } catch (systemError) {
      console.error('Kritis: Kesalahan pemrosesan jaringan pada POST router. Detail: ' + systemError.message);
      return this.createJsonResponse({ success: false, message: 'Kesalahan server internal saat merutekan data.' }, 500);
    }
  }

  createJsonResponse(responseObject, httpStatusCode) {
    const jsonTextOutput = ContentService.createTextOutput(JSON.stringify(responseObject));
    jsonTextOutput.setMimeType(ContentService.MimeType.JSON);
    return jsonTextOutput;
  }
}

function doGet(eventData) {
  const templateHtmlObject = HtmlService.createTemplateFromFile('Page');
  
  
  templateHtmlObject.urlParams = Object.assign({}, (eventData && eventData.parameter) || {});
  templateHtmlObject.centralLogin = consumeCentralTicket_(templateHtmlObject.urlParams.central_ticket);
  delete templateHtmlObject.urlParams.central_ticket;
  
  console.log('Akses jaringan: Memuat antarmuka pengguna SPA.');

  return templateHtmlObject.evaluate()
    .setTitle('CBT | ' + getSchoolMetadata_().schoolName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(eventData) {
  try {
    if (eventData && eventData.postData && eventData.postData.contents && JSON.parse(eventData.postData.contents).method) return schoolPublicApi_(eventData);
  } catch (error) { /* Let the legacy router return its existing invalid-payload response. */ }
  const postRequestRouterInstance = new PostRequestRouter(eventData);
  return postRequestRouterInstance.processRequest();
}

function include_(filenameString) {
  return HtmlService.createHtmlOutputFromFile(filenameString).getContent();
}

function saveLogoFromClient_(base64ImageString) {
  const applicationConfigurationManagerInstance = new ApplicationConfigurationService();
  return applicationConfigurationManagerInstance.saveApplicationLogo(base64ImageString);
}

function getAppConfig_() {
  const applicationConfigurationManagerInstance = new ApplicationConfigurationService();
  const config = applicationConfigurationManagerInstance.getGlobalConfiguration();
  const school = getSchoolMetadata_();
  config.schoolId = school.schoolId;
  config.schoolName = school.schoolName;
  config.centralAdminUrl = school.centralAdminUrl || '';
  config.schoolTheme = { primary: school.themePrimary, hover: school.themeHover, accent: school.themeAccent, background: school.themeBackground, onPrimary: school.themeOnPrimary };
  config.ownerGoogleLoginAvailable = isGoogleSchoolOwner_();
  return config;
}

function resetSuperadminPasswordOnce() {
  requireSchoolOwner_();
  const props = PropertiesService.getScriptProperties();

  const newPassword = props.getProperty(
    'SUPERADMIN_RESET_TEMP_PASSWORD'
  );

  if (!newPassword || newPassword.length < 14) {
    throw new Error('Password baru belum diisi atau terlalu pendek.');
  }

  const hashBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    newPassword
  );

  const passwordHash = hashBytes.map(function(byte) {
    return (byte < 0 ? byte + 256 : byte)
      .toString(16)
      .padStart(2, '0');
  }).join('');

  props.setProperty(
    'SUPERADMIN_PASSWORD_HASH',
    passwordHash
  );

  props.deleteProperty('SUPERADMIN_RESET_TEMP_PASSWORD');

  Logger.log('Password Superadmin berhasil direset.');
}


/** Atur ADMIN_PASSWORD baru secara aman dari Script Properties (14+ karakter). */
function resetAdminPasswordOnce() {
  requireSchoolOwner_();
  const props = PropertiesService.getScriptProperties();
  const password = props.getProperty('ADMIN_RESET_TEMP_PASSWORD');
  if (!password || password.length < 14) {
    throw new Error('Isi ADMIN_RESET_TEMP_PASSWORD (minimal 14 karakter) di Script Properties.');
  }
  const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  const hash = hashBytes.map(function(b) {return (b < 0 ? b+256 : b).toString(16).padStart(2,'0');}).join('');
  props.setProperty('ADMIN_PASSWORD', hash);
  props.deleteProperty('ADMIN_RESET_TEMP_PASSWORD');
  Logger.log('Password admin sudah direset untuk ' + getSchoolMetadata_().schoolId);
}
