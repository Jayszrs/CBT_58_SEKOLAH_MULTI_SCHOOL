function normalizeStudentId_(value) {
  const id = String(value == null ? '' : value).trim();
  return /^[A-Za-z0-9_-]{1,32}$/.test(id) ? id : '';
}

function credentialHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value)).map(function (byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0');
  }).join('');
}

function newOpaqueCredential_() {
  return Utilities.getUuid() + Utilities.getUuid();
}

function verifyStudentCredential_(nisn, token) {
  const id = normalizeStudentId_(nisn);
  if (!id || typeof token !== 'string' || !/^[0-9a-f-]{72}$/i.test(token)) return false;
  const response = new FirebaseDatabaseService().readData('sesi_siswa/' + id);
  const session = response.success && response.data;
  return !!session && session.status === 'Aktif' && Number(session.auth_expiry) > Date.now() &&
    session.school_id === getSchoolMetadata_().schoolId && session.credential_hash === credentialHash_(token);
}

function invalidStudentSession_() {
  return { success: false, sessionExpired: true, message: 'Sesi siswa tidak valid atau berakhir. Silakan login kembali.' };
}

function issueAdminSession_(passwordHash) {
  const token = 'ADMIN:' + newOpaqueCredential_();
  const data = {school_id:getSchoolMetadata_().schoolId,password_hash:passwordHash,expires_at:Date.now()+1800000};
  CacheService.getScriptCache().put('ADMIN_TOKEN_' + credentialHash_(token), JSON.stringify(data), 1800);
  return token;
}

function verifyAdminCredential_(token) {
  if (typeof token !== 'string') return false;
  if (token.startsWith('OWNER:')) return isGoogleSchoolOwner_() && CacheService.getScriptCache().get('GOOGLE_' + token) === 'valid';
  if (!/^ADMIN:[0-9a-f-]{72}$/i.test(token)) return false;
  try {
    const data = JSON.parse(CacheService.getScriptCache().get('ADMIN_TOKEN_' + credentialHash_(token)) || 'null');
    return !!data && data.school_id === getSchoolMetadata_().schoolId && data.expires_at > Date.now() &&
      data.password_hash === PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  } catch (error) { return false; }
}

function authorizeMediaRead_(auth) {
  if (!auth || typeof auth !== 'object') return false;
  if (auth.role === 'admin') return verifyAdminCredential_(auth.token);
  return auth.role === 'student' && verifyStudentCredential_(auth.nisn, auth.token);
}

function requireSchoolOwner_() {
  if (!isGoogleSchoolOwner_()) throw new Error('Fungsi ini hanya dapat dijalankan akun Google pemilik sekolah.');
}

function safeSheetLiteral_(value) {
  const text = String(value == null ? '' : value);
  return /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
}
