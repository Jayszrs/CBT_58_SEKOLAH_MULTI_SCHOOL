import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes, createHash} from 'node:crypto';
import {googleOwnerApi} from './google-owner-api.mjs';
import {writeConfigCsv} from './sync-config-csv.mjs';

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'config', 'central-admin.json');
const config = JSON.parse(fs.readFileSync(configPath));
const schools = JSON.parse(fs.readFileSync(path.join(root, 'config', 'schools.json')));
const privateDirectory = path.join(process.env.LOCALAPPDATA || os.homedir(), 'CBT58-Private');
const privatePath = path.join(privateDirectory, 'central-admin.json');
const credentialPath = path.join(privateDirectory, 'AKSES-SUPER-ADMIN.txt');
const api = 'https://script.googleapis.com/v1/projects';
const save = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const execute = process.argv.includes('--execute');
const inspectOnly = process.argv.includes('--check-auth');
const availableOnly = process.argv.includes('--available-accounts');
const accountFlag = process.argv.indexOf('--account');
const selectedAccount = accountFlag < 0 ? null : process.argv[accountFlag + 1];
if (accountFlag >= 0 && !schools.some(s => s.account_id === selectedAccount)) throw Error('--account memerlukan kode akun operasional yang valid.');
const report = {checked_at: new Date().toISOString(), owner: config.owner_email, schools: [], complete: false};
const reportPath = path.join(root, 'reports', 'central-admin-provisioning.json');
const checkpoint = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

if (!execute && !inspectOnly) {
  console.log(JSON.stringify({owner: config.owner_email, username: config.username, schools: schools.length,
    actions: ['Periksa login 12 akun', 'Buka folder media sebagai pembaca publik', 'Pasang akses super admin tanpa mengganti URL 58 sekolah', 'Deploy panel super admin'],
    execute: 'node scripts/provision-central-admin.mjs --execute'}, null, 2));
  process.exit(0);
}

const clients = new Map();
for (const email of [...new Set([config.owner_email, ...schools.filter(s => !selectedAccount || s.account_id === selectedAccount).map(s => s.account_email)])]) {
  try { clients.set(email, await googleOwnerApi(email)); }
  catch (error) { report.schools.push({owner: email, status: 'AUTH_REQUIRED', message: error.message}); }
}
if (report.schools.length && (!availableOnly || !clients.has(config.owner_email))) {
  checkpoint();
  console.error('Login akun pemilik belum lengkap. Tidak ada deployment sekolah yang diubah.');
  for (const failure of report.schools) console.error(failure.owner + ': AUTH_REQUIRED');
  process.exit(2);
}
if (inspectOnly) { console.log('Login seluruh 12 akun sesuai.'); process.exit(0); }
report.auth_required = report.schools;
report.schools = [];

// Private material lives outside the checkout and is never logged or committed.
fs.mkdirSync(privateDirectory, {recursive: true});
let secrets;
if (fs.existsSync(privatePath)) {
  secrets = JSON.parse(fs.readFileSync(privatePath));
  if (secrets.ownerEmail !== config.owner_email) throw Error('Pemilik berbeda dari checkpoint privat; periksa konfigurasi.');
} else {
  const password = 'Cbt58-' + randomBytes(24).toString('base64url');
  const salt = randomBytes(32).toString('hex');
  secrets = {ownerEmail: config.owner_email, username: config.username, salt, passwordHash: hash(salt + ':' + password),
    schoolKeys: Object.fromEntries(schools.map(s => [s.school_id, randomBytes(32).toString('hex')])), deployed: {}};
  fs.writeFileSync(privatePath, JSON.stringify(secrets, null, 2), {mode: 0o600});
  fs.writeFileSync(credentialPath, 'Pemilik: ' + config.owner_email + '\nUsername: ' + config.username + '\nPassword awal: ' + password + '\n\nGanti password melalui panel setelah masuk.\n', {mode: 0o600});
}
const saveSecrets = () => fs.writeFileSync(privatePath, JSON.stringify(secrets, null, 2), {mode: 0o600});

function source(name, type, text) { return {name, type, source: text}; }
function upsert(files, file) {
  const index = files.findIndex(f => f.name === file.name);
  if (index < 0) files.push(file); else files[index] = file;
}
function insert(files, name, marker, before, after) {
  const file = files.find(f => f.name === name);
  if (!file) throw Error('Berkas ' + name + ' tidak ditemukan.');
  if (file.source.includes(marker)) return;
  if (!file.source.includes(before)) throw Error('Sumber ' + name + ' berubah; pemasangan dihentikan agar tidak menimpa perubahan.');
  file.source = file.source.replace(before, after);
}
async function versionAndDeploy(request, scriptId, deploymentId, description) {
  const version = await request(api + '/' + scriptId + '/versions', 'POST', {description});
  const deploymentConfig = {versionNumber: version.versionNumber, manifestFileName: 'appsscript', description};
  if (!deploymentId) {
    // Recover a successful create whose response/checkpoint was interrupted.
    const existing = await request(api + '/' + scriptId + '/deployments');
    deploymentId = existing.deployments?.find(d => d.deploymentConfig?.description === description &&
      d.entryPoints?.some(e => e.entryPointType === 'WEB_APP'))?.deploymentId;
  }
  const deployed = deploymentId ? await request(api + '/' + scriptId + '/deployments/' + deploymentId, 'PUT', {deploymentConfig})
    : await request(api + '/' + scriptId + '/deployments', 'POST', deploymentConfig);
  const url = deployed.entryPoints?.find(e => e.entryPointType === 'WEB_APP')?.webApp?.url;
  if (!url) throw Error('Google tidak mengembalikan URL web app.');
  return {deployment_id: deployed.deploymentId, webapp_url: url, version: version.versionNumber};
}

try {
  for (const school of schools) {
    if (selectedAccount && school.account_id !== selectedAccount) {
      report.schools.push({school: school.school_code, status: secrets.deployed[school.school_id] ? 'DEPLOYED_PREVIOUSLY' : 'AUTH_REQUIRED', owner: school.account_email});
      continue;
    }
    if (!clients.has(school.account_email)) {
      report.schools.push({school: school.school_code, status: 'AUTH_REQUIRED', owner: school.account_email}); checkpoint(); continue;
    }
    const request = clients.get(school.account_email);
    const entry = {school: school.school_code, status: 'STARTED'};
    report.schools.push(entry); checkpoint();
    const folderBase = 'https://www.googleapis.com/drive/v3/files/' + school.drive_folder_id;
    const folder = await request(folderBase + '?fields=id,mimeType,owners(emailAddress),webViewLink');
    if (folder.mimeType !== 'application/vnd.google-apps.folder' || !folder.owners?.some(o => o.emailAddress === school.account_email)) throw Error('Pemilik folder tidak sesuai: ' + school.school_code);
    const permissions = await request(folderBase + '/permissions?fields=permissions(id,type,role,allowFileDiscovery)');
    const publicPermission = permissions.permissions?.find(p => p.type === 'anyone');
    if (!publicPermission) await request(folderBase + '/permissions', 'POST', {type: 'anyone', role: 'reader', allowFileDiscovery: false});
    else if (publicPermission.allowFileDiscovery) await request(folderBase + '/permissions/' + publicPermission.id, 'PATCH', {allowFileDiscovery: false});
    const verified = await request(folderBase + '/permissions?fields=permissions(type,role,allowFileDiscovery)');
    if (!verified.permissions?.some(p => p.type === 'anyone' && ['reader', 'writer'].includes(p.role))) throw Error('Izin publik folder belum terbaca.');
    entry.drive_public = true; checkpoint();
    const content = await request(api + '/' + school.script_id + '/content');
    const files = content.files.map(f => ({...f, source: f.source.replace(/\r\n/g, '\n')}));
    const privateSource = 'function getSchoolCentralKey_() { return ' + JSON.stringify(secrets.schoolKeys[school.school_id]) + '; }\n';
    const signature = hash(privateSource + fs.readFileSync(path.join(root, 'backend', 'CentralAccess.js'), 'utf8'));
    const done = secrets.deployed[school.school_id];
    if (done?.signature === signature && files.some(f => f.name === 'CentralAccessPrivate' && f.source === privateSource)) {
      const current = await request(api + '/' + school.script_id + '/deployments/' + school.deployment_id);
      if (current.deploymentConfig?.versionNumber === done.version) {
        entry.status = 'DEPLOYED'; entry.webapp_url = school.webapp_url; entry.version = done.version; checkpoint(); continue;
      }
    }
    const backupPath = path.join(privateDirectory, school.school_id + '-before-central.json');
    if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, JSON.stringify(content), {mode: 0o600});
    upsert(files, source('CentralAccess', 'SERVER_JS', fs.readFileSync(path.join(root, 'backend', 'CentralAccess.js'), 'utf8')));
    upsert(files, source('CentralAccessPrivate', 'SERVER_JS', privateSource));
    insert(files, 'SessionSecurity', 'if (token.startsWith(\'CENTRAL:\'))',
      "function verifyAdminCredential_(token) {\n  if (typeof token !== 'string') return false;",
      "function verifyAdminCredential_(token) {\n  if (typeof token !== 'string') return false;\n  if (token.startsWith('CENTRAL:')) return verifyCentralSchoolSession_(token);");
    insert(files, 'Code', 'templateHtmlObject.centralLogin = consumeCentralTicket_',
      'templateHtmlObject.urlParams = (eventData && eventData.parameter) || {};',
      "templateHtmlObject.urlParams = Object.assign({}, (eventData && eventData.parameter) || {});\n  templateHtmlObject.centralLogin = consumeCentralTicket_(templateHtmlObject.urlParams.central_ticket);\n  delete templateHtmlObject.urlParams.central_ticket;");
    insert(files, 'AuthService', '/^(OWNER|ADMIN|CENTRAL):/', '/^(OWNER|ADMIN):/', '/^(OWNER|ADMIN|CENTRAL):/');
    insert(files, 'Page', 'const INITIAL_CENTRAL_LOGIN =',
      'const INITIAL_URL_PARAMS = <?!= JSON.stringify(urlParams) ?>;',
      'const INITIAL_URL_PARAMS = <?!= JSON.stringify(urlParams) ?>;\n    const INITIAL_CENTRAL_LOGIN = <?!= JSON.stringify(centralLogin) ?>;');
    insert(files, 'JavaScript', "typeof INITIAL_CENTRAL_LOGIN !== 'undefined'",
      "  } catch (e) { }\n\n\n  function showLoading()",
      "  } catch (e) { }\n\n  if (typeof INITIAL_CENTRAL_LOGIN !== 'undefined' && INITIAL_CENTRAL_LOGIN) {\n    AppStore.user = INITIAL_CENTRAL_LOGIN;\n    try { localStorage.setItem('CBT_SESSION', JSON.stringify(AppStore.user)); } catch (e) { }\n  }\n\n  function showLoading()");
    await request(api + '/' + school.script_id + '/content', 'PUT', {files});
    const deployment = await versionAndDeploy(request, school.script_id, school.deployment_id, school.school_code + ' akses super admin pusat');
    if (deployment.webapp_url !== school.webapp_url) throw Error('URL sekolah berubah; periksa deployment.');
    secrets.deployed[school.school_id] = {...deployment, signature}; saveSecrets();
    entry.status = 'DEPLOYED'; entry.version = deployment.version; entry.webapp_url = deployment.webapp_url;
    school.deployed_version = deployment.version;
    fs.writeFileSync(path.join(root, 'config', 'schools.json'), JSON.stringify(schools, null, 2) + '\n');
    writeConfigCsv('schools', schools);
    checkpoint(); console.log(school.school_code + ': folder publik dan akses super admin terpasang.');
  }
  const request = clients.get(config.owner_email);
  if (!config.script_id) {
    const project = await request(api, 'POST', {title: 'CBT 58 Sekolah - Super Admin Pusat'});
    config.script_id = project.scriptId; save();
  }
  const files = fs.readdirSync(path.join(root, 'admin-central')).filter(f => /\.(js|html|json)$/.test(f)).map(f =>
    source(f.replace(/\.(js|html|json)$/, ''), f.endsWith('.html') ? 'HTML' : f.endsWith('.json') ? 'JSON' : 'SERVER_JS', fs.readFileSync(path.join(root, 'admin-central', f), 'utf8')));
  const enabledKeys = Object.fromEntries(Object.entries(secrets.schoolKeys).filter(([id]) => secrets.deployed[id]));
  const privateConfig = {ownerEmail: secrets.ownerEmail, username: secrets.username, salt: secrets.salt, passwordHash: secrets.passwordHash, schoolKeys: enabledKeys};
  files.push(source('CentralPrivateConfig', 'SERVER_JS', 'function getCentralPrivateConfig_() { return ' + JSON.stringify(privateConfig) + '; }\n'));
  await request(api + '/' + config.script_id + '/content', 'PUT', {files});
  const deployed = await versionAndDeploy(request, config.script_id, config.deployment_id, 'CBT58 Super Admin Pusat');
  const installed = Object.keys(enabledKeys).length;
  Object.assign(config, deployed, {status: installed === schools.length ? 'DEPLOYED_REQUIRES_LIVE_ACCEPTANCE' : 'PARTIALLY_DEPLOYED_REQUIRES_LIVE_ACCEPTANCE', installed_schools: installed}); save();
  report.deployment_complete = installed === schools.length; report.installed_schools = installed;
  report.live_acceptance = false; report.webapp_url = config.webapp_url; checkpoint();
  console.log('Panel: ' + (config.public_panel_url || config.webapp_url));
  console.log('Kredensial tersimpan privat: ' + credentialPath);
  console.log('Buka panel sebagai dimazunj14@gmail.com untuk menyelesaikan izin Google, lalu uji login dan tombol Kelola.');
} catch (error) {
  report.error = error.message; checkpoint(); console.error(error.message); process.exitCode = 1;
}
