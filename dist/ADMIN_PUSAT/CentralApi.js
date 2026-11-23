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
      centralChangePassword: centralChangePassword
    };
    if (!Object.prototype.hasOwnProperty.call(methods, input.method)) throw Error('Operasi tidak tersedia.');
    return centralApiJson_({ok: true, result: methods[input.method].apply(null, input.args)});
  } catch (error) {
    return centralApiJson_({ok: false, error: String(error.message || 'Permintaan gagal.')});
  }
}

function centralApiJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
