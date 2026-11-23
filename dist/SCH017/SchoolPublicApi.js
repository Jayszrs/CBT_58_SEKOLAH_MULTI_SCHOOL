/** The public school transport calls the same guarded operations as Google RPC. */
function schoolPublicApi_(event) {
  try {
    var raw = event && event.postData && event.postData.contents;
    if (typeof raw !== 'string' || raw.length > 6000000) throw Error('Permintaan terlalu besar atau tidak valid.');
    var input = JSON.parse(raw);
    if (!input || !Array.isArray(input.args) || input.args.length > 8) throw Error('Permintaan tidak valid.');
    if (input.method === 'bootstrap') {
      var params = input.args[0] || {};
      var config = getAppConfig_();
      config.ownerGoogleLoginAvailable = false;
      return schoolApiJson_({ok: true, result: {config: config, centralLogin: consumeCentralTicket_(params.central_ticket)}});
    }
    var methods = {
      loginAdmin: loginAdmin, checkAdminLoginStatus: checkAdminLoginStatus, loginSiswa: loginSiswa,
      executeAdminAction: executeAdminAction, startUjian: startUjian, pingSimpanJawaban: pingSimpanJawaban,
      submitUjian: submitUjian, getImageBase64: getImageBase64, getMultipleImageBase64: getMultipleImageBase64
    };
    if (!Object.prototype.hasOwnProperty.call(methods, input.method)) throw Error('Operasi sekolah tidak tersedia.');
    return schoolApiJson_({ok: true, result: methods[input.method].apply(null, input.args)});
  } catch (error) { return schoolApiJson_({ok: false, error: String(error.message || 'Permintaan gagal.')}); }
}

function schoolApiJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
