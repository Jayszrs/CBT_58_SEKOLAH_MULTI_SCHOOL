import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const requiredPermissions = [
  'firebase.projects.update', 'resourcemanager.projects.get',
  'serviceusage.services.enable', 'serviceusage.services.get',
];

export function resolveFirebaseTools() {
  const candidates = [];
  try { candidates.push(require.resolve('firebase-tools/package.json')); } catch {}
  candidates.push(
    path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', 'firebase-tools', 'package.json'),
    path.resolve(path.dirname(process.execPath), 'node_modules', 'firebase-tools', 'package.json'),
    path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'firebase-tools', 'package.json'),
  );
  for (const entry of (process.env.PATH || '').split(path.delimiter)) {
    if (entry) candidates.push(path.join(entry, 'node_modules', 'firebase-tools', 'package.json'));
  }
  const manifest = candidates.find(candidate => fs.existsSync(candidate));
  if (!manifest) throw Error('Firebase CLI belum ditemukan. Jalankan npm install -g firebase-tools.');
  return path.dirname(manifest);
}

// Use the installed CLI's OAuth handling without exporting tokens or creating keys.
// Its database helper is also used by `firebase init database` for the first RTDB.
export function loadFirebaseApi(toolsDirectory, email) {
  const fromCli = createRequire(path.join(toolsDirectory, 'package.json'));
  const auth = fromCli('./lib/auth.js');
  const account = auth.getAllAccounts().find(item => item.user.email.toLowerCase() === email.toLowerCase());
  if (!account) throw Error(`Akun ${email} belum login. Jalankan firebase login:add.`);
  auth.setActiveAccount({}, account);
  const { Client } = fromCli('./lib/apiv2.js');
  const cloud = new Client({ urlPrefix: 'https://cloudresourcemanager.googleapis.com', apiVersion: 'v1' });
  const firebase = new Client({ urlPrefix: 'https://firebase.googleapis.com', apiVersion: 'v1beta1' });
  const projects = fromCli('./lib/management/projects.js');
  const database = fromCli('./lib/management/database.js');
  const { ensure } = fromCli('./lib/ensureApiEnabled.js');
  return {
    getCloudProject: async id => (await cloud.request({ method: 'GET', path: `/projects/${id}` })).body,
    getFirebaseProject: async id => (await firebase.request({ method: 'GET', path: `/projects/${id}` })).body,
    createCloudProject: id => projects.createCloudProject(id, { displayName: id }),
    addFirebase: id => projects.addFirebaseToCloudProject(id),
    testPermissions: async id => (await cloud.request({ method: 'POST', path: `/projects/${id}:testIamPermissions`, body: { permissions: requiredPermissions } })).body.permissions || [],
    ensureDatabaseApi: id => ensure(id, 'https://firebasedatabase.googleapis.com', 'database', false),
    ensureSheetsApi: id => ensure(id, 'https://sheets.googleapis.com', 'sheets', false),
    listDatabases: id => database.listDatabaseInstances(id, database.DatabaseLocation.ANY),
    createDefaultDatabase: (id, name, location) => database.createInstance(id, name, location, database.DatabaseInstanceType.DEFAULT_DATABASE),
    getDatabaseRules: async databaseUrl => (await new Client({ urlPrefix: databaseUrl }).request({ method: 'GET', path: '/.settings/rules.json' })).body,
  };
}

async function findOrNull(get) {
  try { return await get(); } catch (error) {
    if (error.status === 404 || error.context?.response?.statusCode === 404) return null;
    throw error;
  }
}

export async function ensureFirebaseProject(api, projectId, email, log = console.log, { createWhenLookupForbidden = false } = {}) {
  let cloud;
  try {
    cloud = await findOrNull(() => api.getCloudProject(projectId));
  } catch (error) {
    const status = error.status || error.context?.response?.statusCode;
    if (!createWhenLookupForbidden || status !== 403) throw error;
    // Google may hide an unused project ID behind 403. A create request cannot
    // overwrite an existing project; global ID conflicts remain API errors.
    log(`Project ${projectId} belum dapat dibaca. Mencoba pembuatan baru dengan akun ${email}.`);
  }
  if (!cloud) {
    log(`Membuat Google Cloud project ${projectId} ...`);
    await api.createCloudProject(projectId);
    cloud = await api.getCloudProject(projectId);
  }
  if (cloud.lifecycleState !== 'ACTIVE') throw Error(`Project ${projectId} tidak ACTIVE; proses dihentikan.`);
  const existing = await findOrNull(() => api.getFirebaseProject(projectId));
  if (existing) {
    log(`Firebase project ${projectId} sudah aktif. Melanjutkan project yang sama.`);
    return existing;
  }
  log(`Google Cloud project ${projectId} sudah ada. Mengaktifkan Firebase ...`);
  try {
    await api.addFirebase(projectId);
  } catch (error) {
    const status = error.status || error.original?.status || error.context?.response?.statusCode;
    if (status !== 403) throw error;
    let diagnostic = 'Periksa izin akun dan persetujuan ketentuan Firebase.';
    try {
      const granted = await api.testPermissions(projectId);
      const missing = requiredPermissions.filter(permission => !granted.includes(permission));
      diagnostic = missing.length ? `Izin yang belum ada: ${missing.join(', ')}.` : 'Semua izin proyek tersedia. Periksa persetujuan ketentuan Firebase pada akun ini.';
    } catch {}
    throw Error(`Aktivasi Firebase ditolak (403) untuk ${email}. ${diagnostic}\n` +
      `Buka https://console.firebase.google.com/?forceCheckTos=true&authuser=${encodeURIComponent(email)}\n` +
      `Setelah persetujuan selesai, jalankan ulang perintah yang sama. Project ${projectId} akan dilanjutkan.`, { cause: error });
  }
  const project = await api.getFirebaseProject(projectId);
  log(`Firebase project ${projectId} berhasil diaktifkan.`);
  return project;
}

export async function ensureDefaultDatabase(api, projectId, location = 'asia-southeast1', log = console.log) {
  await api.ensureDatabaseApi(projectId);
  const instances = await api.listDatabases(projectId);
  let instance = instances.find(item => item.type?.toLowerCase() === 'default_database');
  if (!instance) {
    log(`Membuat Realtime Database default di ${location} ...`);
    instance = await api.createDefaultDatabase(projectId, `${projectId}-default-rtdb`, location);
  }
  if (instance.state?.toLowerCase() !== 'active' || !instance.databaseUrl || !instance.name) {
    throw Error('Realtime Database default belum ACTIVE atau URL aktual belum tersedia. Jalankan ulang untuk melanjutkan.');
  }
  log(`Realtime Database: ${instance.databaseUrl}`);
  return instance;
}
