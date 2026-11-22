
/**
 * FIREBASE AUTHENTICATION
 * Service Account + JWT OAuth2
 * CBT-GAS MASTER PRIBADI
 */

function firebaseBase64UrlEncode_(value) {
  return Utilities.base64EncodeWebSafe(
    value,
    Utilities.Charset.UTF_8
  ).replace(/=+$/g, '');
}


/**
 * Membuat OAuth2 Access Token menggunakan
 * private key Service Account.
 */
function getFirebaseOAuthAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'FIREBASE_OAUTH_ACCESS_TOKEN';

  const cachedToken = cache.get(cacheKey);

  if (cachedToken) {
    return cachedToken;
  }

  const properties = PropertiesService.getScriptProperties();

  const clientEmail = properties.getProperty(
    'FIREBASE_CLIENT_EMAIL'
  );

  let privateKey = properties.getProperty(
    'FIREBASE_PRIVATE_KEY'
  );

  if (!clientEmail || !privateKey) {
    // The deploying Google owner already has IAM access; no persistent key is needed.
    return ScriptApp.getOAuthToken();
  }

  // Mengubah karakter literal \n menjadi baris baru.
  privateKey = privateKey.replace(/\\n/g, '\n').trim();

  const issuedAt = Math.floor(Date.now() / 1000);

  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const jwtPayload = {
    iss: clientEmail,
    scope:
      'https://www.googleapis.com/auth/firebase.database ' +
      'https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600
  };

  const encodedHeader = firebaseBase64UrlEncode_(
    JSON.stringify(jwtHeader)
  );

  const encodedPayload = firebaseBase64UrlEncode_(
    JSON.stringify(jwtPayload)
  );

  const unsignedToken = encodedHeader + '.' + encodedPayload;

  const signature = Utilities.computeRsaSha256Signature(
    unsignedToken,
    privateKey
  );

  const encodedSignature = Utilities.base64EncodeWebSafe(
    signature
  ).replace(/=+$/g, '');

  const jwtAssertion = unsignedToken + '.' + encodedSignature;

  const tokenResponse = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type:
          'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwtAssertion
      },
      muteHttpExceptions: true
    }
  );

  const responseCode = tokenResponse.getResponseCode();
  const responseText = tokenResponse.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    console.error(
      'Firebase OAuth gagal. HTTP ' + responseCode +
      ': ' + responseText
    );

    throw new Error(
      'Gagal memperoleh OAuth2 Access Token. HTTP ' +
      responseCode
    );
  }

  const tokenData = JSON.parse(responseText);

  if (!tokenData.access_token) {
    throw new Error(
      'OAuth2 tidak mengembalikan access_token.'
    );
  }

  const expiresIn = Number(tokenData.expires_in || 3600);

  cache.put(
    cacheKey,
    tokenData.access_token,
    Math.max(60, Math.min(3500, expiresIn - 60))
  );

  return tokenData.access_token;
}


/**
 * FIREBASE DATABASE SERVICE
 */
class FirebaseDatabaseService {

  constructor() {
    this.scriptSystemProperties =
      PropertiesService.getScriptProperties();

    const databaseUrlString =
      this.scriptSystemProperties.getProperty(
        'FIREBASE_DATABASE_URL'
      ) || getSchoolMetadata_().firebaseDatabaseUrl;

    if (!databaseUrlString) {
      throw new Error(
        'FIREBASE_DATABASE_URL belum dikonfigurasi.'
      );
    }

    this.databaseUrl =
      databaseUrlString.replace(/\/+$/, '') + '/';

  }


  /**
   * Permintaan REST API Firebase.
   */
  requestFirebase_(method, pathString, dataObject) {

    try {
      const accessToken =
        getFirebaseOAuthAccessToken_();

      const cleanPath = String(pathString || '')
        .replace(/^\/+|\/+$/g, '');

      const schoolIdentity = getSchoolMetadata_();
      const schoolId = schoolIdentity.schoolId;
      if (!/^SCH\d{3,}$/.test(schoolId)) {
        throw new Error('Identitas sekolah pada paket deployment tidak valid.');
      }
      const scopedPath = 'schools/' + schoolId +
        (cleanPath ? '/' + cleanPath : '');
      const endpointUrl = this.databaseUrl + scopedPath + '.json';

      const requestOptions = {
        method: method,
        headers: {
          Authorization: 'Bearer ' + accessToken
        },
        muteHttpExceptions: true
      };

      if (method !== 'get') {
        requestOptions.contentType = 'application/json';
        requestOptions.payload = JSON.stringify(dataObject);
      }

      const response = UrlFetchApp.fetch(
        endpointUrl,
        requestOptions
      );

      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      let responseData = null;

      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          responseData = responseText;
        }
      }

      if (responseCode >= 200 && responseCode < 300) {
        return {
          success: true,
          data: responseData
        };
      }

      console.error(
        'Firebase REST API gagal. HTTP ' +
        responseCode + ': ' + responseText
      );

      return {
        success: false,
        message:
          responseData &&
          responseData.error &&
          responseData.error.message
            ? responseData.error.message
            : 'Firebase HTTP Error ' + responseCode,
        data: responseData
      };

    } catch (error) {

      console.error(
        'Firebase request gagal: ' + error.message
      );

      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }


  readData(pathString) {
    return this.requestFirebase_(
      'get',
      pathString,
      null
    );
  }


  writeData(pathString, dataObject) {
    return this.requestFirebase_(
      'put',
      pathString,
      dataObject
    );
  }


  patchData(pathString, dataObject) {
    return this.requestFirebase_(
      'patch',
      pathString,
      dataObject
    );
  }

}

function testFirebaseConnection() {
  const firebase = new FirebaseDatabaseService();

  const result = firebase.readData('_connection_test');

  if (!result.success) {
    throw new Error(
      'Koneksi Firebase gagal: ' + result.message
    );
  }

  console.log('BERHASIL: Firebase terhubung!');
  console.log('Hasil baca: ' + JSON.stringify(result.data));
}

function testFirebaseWriteRead() {
  const firebase = new FirebaseDatabaseService();

  const testData = {
    status: 'connected',
    message: 'CBT-GAS MASTER PRIBADI',
    timestamp: new Date().toISOString()
  };

  const writeResult = firebase.writeData(
    '_connection_test',
    testData
  );

  if (!writeResult.success) {
    throw new Error('Gagal menulis: ' + writeResult.message);
  }

  const readResult = firebase.readData('_connection_test');

  if (!readResult.success) {
    throw new Error('Gagal membaca: ' + readResult.message);
  }

  console.log('BERHASIL: Firebase WRITE dan READ aktif.');
  console.log(JSON.stringify(readResult.data));
}
