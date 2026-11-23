/** Public transport; protected operations retain the central session checks. */
function doPost(event) {
  try {
    var raw = event && event.postData && event.postData.contents;
    if (typeof raw !== 'string' || raw.length > 16384) throw Error('Permintaan tidak valid.');
    var input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || !Array.isArray(input.args) || input.args.length > 4) throw Error('Permintaan tidak valid.');
    if (input.method === 'health') return centralApiJson_({ok: true, result: {application: 'cbt58-central', public: true}});
    var methods = {
      centralLogin: centralLogin,
      centralSchools: centralSchools,
      centralOpenSchool: centralOpenSchool,
      centralLogout: centralLogout,
      centralChangePassword: centralChangePassword,
      centralAuthenticateSchool: centralAuthenticateSchool
    };
    if (!Object.prototype.hasOwnProperty.call(methods, input.method)) throw Error('Operasi tidak tersedia.');
    return centralApiJson_({ok: true, result: methods[input.method].apply(null, input.args)});
  } catch (error) {
    return centralApiJson_({ok: false, error: String(error.message || 'Permintaan gagal.')});
  }
}

function centralAuthenticateSchool(username, password, code) {
  if (String(username || '').trim().toLowerCase() !== 'superadmin') return {success: false, message: 'Username superadmin tidak valid.'};
  var login = centralLogin('superadmin', password);
  if (!login.success) return login;
  try {
    var opened = centralOpenSchool(login.token, code);
    var ticket = opened.url.match(/[?&]central_ticket=([^&]+)/);
    if (!ticket) throw Error('Tiket sekolah belum tersedia.');
    return {success: true, ticket: decodeURIComponent(ticket[1])};
  } finally { centralLogout(login.token); }
}

function centralApiJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
