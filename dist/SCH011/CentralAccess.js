/** Per-school signed, short-lived handoff from the central administrator. */
function centralSchoolKey_() {
  return typeof getSchoolCentralKey_ === 'function' ? getSchoolCentralKey_() : '';
}

function loginCentralForSchool_(password) {
  if (!centralSchoolKey_()) return {success: false, centralAccessUnavailable: true, message: 'Akses superadmin sekolah ini belum diaktifkan oleh pemilik.'};
  if (typeof password !== 'string' || password.length < 14 || password.length > 256) return {success: false, message: 'Password superadmin tidak valid.'};
  var school = getSchoolMetadata_();
  var url = school.centralApiUrl || '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return {success: false, message: 'Koneksi superadmin sekolah belum disiapkan.'};
  try {
    var response = UrlFetchApp.fetch(url, {method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({method: 'centralAuthenticateSchool', args: ['superadmin', password, school.schoolCode || school.schoolId.replace('SCH', 'SCH-')]})});
    var wire = JSON.parse(response.getContentText());
    if (!wire.ok) return {success: false, message: wire.error || 'Login superadmin gagal.'};
    if (!wire.result || !wire.result.success) return {success: false, message: wire.result && wire.result.message || 'Login superadmin gagal.'};
    var user = consumeCentralTicket_(wire.result.ticket);
    if (!user) return {success: false, message: 'Tiket superadmin tidak valid atau kedaluwarsa.'};
    return {success: true, sessionToken: user.data.token};
  } catch (error) { return {success: false, message: 'Koneksi ke panel pusat belum berhasil. Coba kembali.'}; }
}

function centralSchoolSignature_(payload) {
  var key = centralSchoolKey_();
  if (!key) return '';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, key)).replace(/=+$/, '');
}

function consumeCentralTicket_(ticket) {
  if (typeof ticket !== 'string' || ticket.length > 1200 || !centralSchoolKey_()) return null;
  var parts = ticket.split('.');
  if (parts.length !== 2 || !/^[\w-]+$/.test(parts[0]) || !/^[\w-]{43}$/.test(parts[1])) return null;
  var expected = centralSchoolSignature_(parts[0]);
  var mismatch = expected.length ^ parts[1].length;
  for (var i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ (parts[1].charCodeAt(i) || 0);
  if (mismatch) return null;
  var claims;
  try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
  catch (error) { return null; }
  if (claims.school !== getSchoolMetadata_().schoolId || !/^[\da-f-]{36}$/i.test(claims.nonce) ||
      !Number.isFinite(claims.expires) || claims.expires <= Date.now() || claims.expires > Date.now() + 65000) return null;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var usedKey = 'CENTRAL_USED_' + claims.nonce;
    if (props.getProperty(usedKey)) return null;
    var now = Date.now();
    var values = props.getProperties();
    Object.keys(values).filter(function(k) { return k.indexOf('CENTRAL_USED_') === 0 && Number(values[k]) < now; })
      .forEach(function(k) { props.deleteProperty(k); });
    props.setProperty(usedKey, String(claims.expires));
    var token = 'CENTRAL:' + newOpaqueCredential_();
    CacheService.getScriptCache().put('CENTRAL_TOKEN_' + credentialHash_(token), JSON.stringify({
      school: claims.school, expires: now + 1800000, keyHash: credentialHash_(centralSchoolKey_())
    }), 1800);
    return {role: 'admin', data: {token: token, username: 'superadmin', schoolId: claims.school}};
  } finally { lock.releaseLock(); }
}

function verifyCentralSchoolSession_(token) {
  if (typeof token !== 'string' || !/^CENTRAL:[\da-f-]{72}$/i.test(token) || !centralSchoolKey_()) return false;
  try {
    var data = JSON.parse(CacheService.getScriptCache().get('CENTRAL_TOKEN_' + credentialHash_(token)) || 'null');
    return !!data && data.school === getSchoolMetadata_().schoolId && data.expires > Date.now() &&
      data.keyHash === credentialHash_(centralSchoolKey_());
  } catch (error) { return false; }
}
