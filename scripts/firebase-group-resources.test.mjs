import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureFirebaseProject, ensureDefaultDatabase, requiredPermissions } from './firebase-group-resources.mjs';

const silent = () => {};
const notFound = () => { throw Object.assign(Error('not found'), { status: 404 }); };
const denied = () => { throw Object.assign(Error('denied'), { status: 403 }); };
const activeCloud = async () => ({ lifecycleState: 'ACTIVE', projectNumber: '123' });

test('continues a Cloud project left behind by failed Firebase activation', async () => {
  let active = false;
  const calls = [];
  const api = {
    getCloudProject: activeCloud,
    getFirebaseProject: async () => active ? { projectId: 'cbt-test' } : notFound(),
    createCloudProject: async () => assert.fail('must not recreate existing Cloud project'),
    addFirebase: async id => { calls.push(id); active = true; },
  };
  assert.equal((await ensureFirebaseProject(api, 'cbt-test', 'owner@example.com', silent)).projectId, 'cbt-test');
  assert.deepEqual(calls, ['cbt-test']);
  await ensureFirebaseProject(api, 'cbt-test', 'owner@example.com', silent);
  assert.deepEqual(calls, ['cbt-test']);
});

test('creates Cloud project before Firebase when neither exists', async () => {
  const calls = [];
  let cloud = false;
  let firebase = false;
  const api = {
    getCloudProject: async () => cloud ? activeCloud() : notFound(),
    createCloudProject: async () => { calls.push('cloud'); cloud = true; },
    getFirebaseProject: async () => firebase ? { projectId: 'cbt-test' } : notFound(),
    addFirebase: async () => { calls.push('firebase'); firebase = true; },
  };
  await ensureFirebaseProject(api, 'cbt-test', 'owner@example.com', silent);
  assert.deepEqual(calls, ['cloud', 'firebase']);
});

test('denied Cloud access is not mistaken for a missing project', async () => {
  await assert.rejects(ensureFirebaseProject({
    getCloudProject: denied,
    createCloudProject: () => assert.fail('must not create on 403'),
  }, 'cbt-test', 'owner@example.com', silent), /denied/);
});

test('403 with full IAM permissions points to account-specific terms workflow', async () => {
  await assert.rejects(ensureFirebaseProject({
    getCloudProject: activeCloud, getFirebaseProject: notFound, addFirebase: denied,
    testPermissions: async () => requiredPermissions,
  }, 'cbt-test', 'owner@example.com', silent), error => {
    assert.match(error.message, /Semua izin/);
    assert.match(error.message, /forceCheckTos=true&authuser=owner%40example.com/);
    assert.match(error.message, /akan dilanjutkan/);
    return true;
  });
});

test('403 from missing IAM permissions names the missing permission', async () => {
  await assert.rejects(ensureFirebaseProject({
    getCloudProject: activeCloud, getFirebaseProject: notFound, addFirebase: denied,
    testPermissions: async () => requiredPermissions.slice(1),
  }, 'cbt-test', 'owner@example.com', silent), /Izin yang belum ada: firebase.projects.update/);
});

const defaultDatabase = { type: 'DEFAULT_DATABASE', state: 'ACTIVE', name: 'actual-name', databaseUrl: 'https://actual-name.example.test' };

test('reuses existing default database and preserves the server URL', async () => {
  const result = await ensureDefaultDatabase({
    ensureDatabaseApi: async () => {}, listDatabases: async () => [defaultDatabase],
    createDefaultDatabase: () => assert.fail('must not create a second database'),
  }, 'cbt-test', 'asia-southeast1', silent);
  assert.equal(result.databaseUrl, defaultDatabase.databaseUrl);
});

test('creates the first default database in the requested location', async () => {
  let creation;
  const result = await ensureDefaultDatabase({
    ensureDatabaseApi: async () => {}, listDatabases: async () => [],
    createDefaultDatabase: async (...args) => { creation = args; return defaultDatabase; },
  }, 'cbt-test', 'asia-southeast1', silent);
  assert.deepEqual(creation, ['cbt-test', 'cbt-test-default-rtdb', 'asia-southeast1']);
  assert.equal(result.databaseUrl, defaultDatabase.databaseUrl);
});

test('refuses a disabled default database instead of creating a replacement', async () => {
  await assert.rejects(ensureDefaultDatabase({
    ensureDatabaseApi: async () => {},
    listDatabases: async () => [{ ...defaultDatabase, state: 'DISABLED' }],
    createDefaultDatabase: () => assert.fail('must not create a replacement'),
  }, 'cbt-test', 'asia-southeast1', silent), /belum ACTIVE/);
});
