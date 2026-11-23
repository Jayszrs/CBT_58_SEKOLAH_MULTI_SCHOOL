/** Super admin: all credentials stay on the Apps Script server. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('CentralPage')
    .setTitle('CBT 58 Sekolah | Super Admin')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function centralHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(function(b) { return (b & 255).toString(16).padStart(2, '0'); }).join('');
}

function centralEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var mismatch = 0;
  for (var i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function centralConfig_() {
  if (typeof getCentralPrivateConfig_ !== 'function') throw Error('Super admin belum dipasang oleh pemilik.');
  var config = getCentralPrivateConfig_();
  var changed = PropertiesService.getScriptProperties().getProperty('CENTRAL_PASSWORD');
  if (changed) {
    var password = JSON.parse(changed);
    config.salt = password.salt;
    config.passwordHash = password.hash;
  }
  return config;
}

function centralIssueSession_() {
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('CENTRAL_SESSION_' + centralHash_(token), JSON.stringify({
    expires: Date.now() + 1800000, version: centralConfig_().passwordHash
  }), 1800);
  return {success: true, token: token, expires: Date.now() + 1800000};
}

function centralRequireSession_(token) {
  if (typeof token !== 'string' || !/^[\da-f-]{72}$/i.test(token)) throw Error('Silakan masuk sebagai super admin.');
  var data = JSON.parse(CacheService.getScriptCache().get('CENTRAL_SESSION_' + centralHash_(token)) || 'null');
  if (!data || data.expires <= Date.now() || data.version !== centralConfig_().passwordHash) throw Error('Sesi berakhir. Silakan masuk kembali.');
}

function centralLogin(username, password) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get('CENTRAL_COOLDOWN')) return {success: false, message: 'Tunggu 3 menit sebelum mencoba kembali.'};
    var config = centralConfig_();
    var valid = typeof password === 'string' && password.length >= 14 && password.length <= 256 &&
      username === config.username && centralEqual_(centralHash_(config.salt + ':' + password), config.passwordHash);
    if (!valid) {
      var failures = Number(cache.get('CENTRAL_FAILURES') || 0) + 1;
      cache.put('CENTRAL_FAILURES', String(failures), 180);
      if (failures >= 5) cache.put('CENTRAL_COOLDOWN', '1', 180);
      return {success: false, message: 'Username atau password salah.'};
    }
    cache.remove('CENTRAL_FAILURES');
    return centralIssueSession_();
  } finally { lock.releaseLock(); }
}

function centralOwnerLogin() {
  var config = centralConfig_();
  // Active user can be empty for anonymous web apps: fail closed in that case.
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || email !== config.ownerEmail.toLowerCase()) return {success: false, message: 'Masuk dengan akun pemilik ' + config.ownerEmail + ', atau gunakan username dan password.'};
  return centralIssueSession_();
}

function centralLogout(token) {
  if (typeof token === 'string') CacheService.getScriptCache().remove('CENTRAL_SESSION_' + centralHash_(token));
  return {success: true};
}

function centralSchools(token) {
  centralRequireSession_(token);
  var config = centralConfig_();
  return {success: true, ownerEmail: config.ownerEmail, schools: getCentralSeed_().map(function(row) {
    return {code: row[0], name: row[1], account: row[2], owner: row[3], group: row[4], color: row[5],
      spreadsheet: row[6], webapp: row[7], drive: row[8], status: row[9],
      centralAccess: !!config.schoolKeys[row[0].replace('-', '')]};
  })};
}

function centralOpenSchool(token, code) {
  centralRequireSession_(token);
  var row = getCentralSeed_().find(function(item) { return item[0] === code; });
  if (!row) throw Error('Sekolah tidak ditemukan.');
  var key = centralConfig_().schoolKeys[code.replace('-', '')];
  if (!key) throw Error('Akses super admin sekolah ini belum dipasang.');
  var claims = {school: code.replace('-', ''), nonce: Utilities.getUuid(), expires: Date.now() + 60000};
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify(claims), Utilities.Charset.UTF_8).replace(/=+$/, '');
  var signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, key)).replace(/=+$/, '');
  return {success: true, url: row[7] + '?admin=1&central_ticket=' + payload + '.' + signature};
}

function centralChangePassword(token, oldPassword, newPassword) {
  centralRequireSession_(token);
  var config = centralConfig_();
  if (typeof oldPassword !== 'string' || oldPassword.length > 256 ||
      !centralEqual_(centralHash_(config.salt + ':' + oldPassword), config.passwordHash)) return {success: false, message: 'Password lama salah.'};
  if (typeof newPassword !== 'string' || newPassword.length < 14 || newPassword.length > 256) return {success: false, message: 'Gunakan 14–256 karakter.'};
  var salt = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('CENTRAL_PASSWORD', JSON.stringify({salt: salt, hash: centralHash_(salt + ':' + newPassword)}));
  centralLogout(token);
  return centralIssueSession_();
}
