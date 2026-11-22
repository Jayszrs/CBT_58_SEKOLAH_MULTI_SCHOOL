/** Provision one account's shared Firebase project and default Realtime Database. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { resolveFirebaseTools, loadFirebaseApi, ensureFirebaseProject, ensureDefaultDatabase } from './firebase-group-resources.mjs';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const accountId = args[0];
const execute = args.includes('--execute');
const yes = args.includes('--yes');
const flag = name => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw Error(`Flag ${name} memerlukan nilai.`);
  return args[index + 1];
};
const accounts = JSON.parse(fs.readFileSync(path.join(root, 'config', 'accounts.json'), 'utf8'));
const schools = JSON.parse(fs.readFileSync(path.join(root, 'config', 'schools.json'), 'utf8'));
const account = accounts.find(item => item.account_id === accountId && item.role === 'OPERASIONAL');
if (!account) { console.error('Pakai AKUN-01 sampai AKUN-12.'); process.exit(1); }
const email = flag('--email') || account.email;
const batch = schools.filter(item => item.account_id === accountId);
const groups = [...new Set(batch.map(item => item.firebase_group))];
if (groups.length !== 1) throw Error('Satu akun harus memiliki tepat satu grup Firebase.');
const group = groups[0];
const groupNo = group.match(/(\d{2})$/)?.[1];
if (!groupNo) throw Error('Grup Firebase tidak valid: ' + group);
const projectId = flag('--project-id') || `cbt-grup-${groupNo}`;
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw Error('Project ID harus 6-30 karakter lowercase/angka/hyphen dan awali huruf.');
const location = flag('--location') || 'asia-southeast1';
if (!['asia-southeast1', 'us-central1', 'europe-west1'].includes(location)) throw Error('Lokasi RTDB tidak valid.');
const groupFolder = path.join(root, 'firebase-groups', group);

console.log(`\n${accountId} -> ${group} -> ${projectId}`);
console.log('Login Firebase yang diharapkan: ' + email);
console.log('Sekolah: ' + batch.map(item => item.school_id).join(', '));
console.log(`Rencana: 1 Firebase Project + 1 Realtime Database default (${location}) untuk semua sekolah pada grup.`);
if (!execute) { console.log('\nDRY RUN. Untuk lanjut setelah login gunakan --execute; tambahkan --yes untuk tanpa dialog.'); process.exit(0); }
if (!email || email.startsWith('ISI_')) throw Error('Email akun belum diisi; gunakan --email atau config/accounts.json.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Email akun tidak valid.');

async function provision() {
  const toolsDirectory = resolveFirebaseTools();
  const firebaseCli = path.join(toolsDirectory, 'lib', 'bin', 'firebase.js');
  const run = (argv, options = {}) => {
    // Invoke Node directly so Windows PATH and shell quoting cannot select another CLI/account.
    const result = spawnSync(process.execPath, [firebaseCli, ...argv, '--account', email], {
      encoding: 'utf8', cwd: groupFolder, ...options,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(`Firebase CLI gagal: firebase ${argv.join(' ')}\n${result.stderr || result.stdout || ''}`);
    return result;
  };
  const api = loadFirebaseApi(toolsDirectory, email);
  console.log('Menggunakan akun Firebase: ' + email);
  if (!yes) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    let typed;
    try { typed = await prompt.question(`Buat/lanjutkan project '${projectId}' sebagai ${email}? Ketik '${group}' untuk lanjut: `); }
    finally { prompt.close(); }
    if (typed !== group) throw Error('Dibatalkan.');
  }
  const project = await ensureFirebaseProject(api, projectId, email, console.log, { createWhenLookupForbidden: true });
  const database = await ensureDefaultDatabase(api, projectId, location);

  fs.mkdirSync(groupFolder, { recursive: true });
  const rulesFile = path.join(groupFolder, 'database.rules.json');
  fs.writeFileSync(rulesFile, JSON.stringify({ rules: { '.read': false, '.write': false } }, null, 2) + '\n');
  const configFile = path.join(groupFolder, 'firebase.json');
  const firebaseConfig = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
  firebaseConfig.database = [{ instance: database.name, rules: 'database.rules.json' }];
  fs.writeFileSync(configFile, JSON.stringify(firebaseConfig, null, 2) + '\n');
  console.log('Deploy Realtime Database Rules: baca/tulis publik DITUTUP.');
  run(['deploy', '--only', 'database', '--project', projectId, '--non-interactive'], { stdio: 'inherit' });

  const instances = await api.listDatabases(projectId);
  const verified = instances.find(item => item.name === database.name && item.state?.toLowerCase() === 'active');
  if (!verified || verified.databaseUrl !== database.databaseUrl) throw Error('Database belum berhasil diverifikasi.');
  const deployedRules = await api.getDatabaseRules(verified.databaseUrl);
  if (deployedRules.rules?.['.read'] !== false || deployedRules.rules?.['.write'] !== false || Object.keys(deployedRules.rules).length !== 2) {
    throw Error('Rules database tertutup belum berhasil diverifikasi.');
  }
  const summary = {
    account_id: accountId, account_email: email, group, project_id: projectId,
    project_number: project.projectNumber, schools: batch.map(item => item.school_id),
    created_or_found_at: new Date().toISOString(), database_status: 'VERIFIED',
    database_url: verified.databaseUrl, database_instance: verified.name,
    database_location: verified.location, public_access: 'DENIED',
    notes: 'Project, database, dan rules tertutup sudah diverifikasi. Jangan simpan kredensial service account di repo.',
  };
  const resultFile = path.join(groupFolder, 'provision-result.json');
  fs.writeFileSync(resultFile, JSON.stringify(summary, null, 2) + '\n');
  console.log('\nRingkasan tanpa password/kunci disimpan: ' + resultFile);
  console.log(`Isi FIREBASE_DATABASE_URL = ${verified.databaseUrl} pada Script Properties untuk: ${batch.map(item => item.school_id).join(', ')}.`);
  console.log('Backend memakai OAuth akun pemilik Apps Script; private key tidak diperlukan. Pastikan pemilik mengizinkan scope Firebase dan email pada setiap aplikasi.');
}

try { await provision(); } catch (error) {
  console.error('\nProvisioning belum selesai: ' + error.message);
  process.exitCode = 1;
}
