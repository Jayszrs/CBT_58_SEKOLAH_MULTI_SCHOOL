import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Google owner login rejects other and anonymous accounts and expires cached sessions', () => {
  const cache = new Map();
  const context = vm.createContext({
    activeEmail: 'other@example.com',
    getSchoolMetadata_: () => ({ ownerEmail: 'owner@example.com' }),
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key,value) => cache.set(key,value) }) },
    Session: { getActiveUser: () => ({ getEmail: () => context.activeEmail }) },
    Utilities: { getUuid: () => 'random-session-id' },
  });
  vm.runInContext(read('backend/SessionSecurity.js') + '\n' + read('backend/AuthService.js'), context);
  assert.equal(vm.runInContext('loginGoogleSchoolOwner().success', context), false);
  context.activeEmail = '';
  assert.equal(vm.runInContext('loginGoogleSchoolOwner().success', context), false);
  context.activeEmail = 'owner@example.com';
  assert.equal(vm.runInContext('loginGoogleSchoolOwner().success', context), true);
  assert.equal(vm.runInContext('loginAdmin("OWNER:random-session-id").success', context), true);
  context.activeEmail = 'other@example.com';
  assert.equal(vm.runInContext('loginAdmin("OWNER:random-session-id").success', context), false);
  context.activeEmail = 'owner@example.com';
  cache.clear();
  assert.equal(vm.runInContext('loginAdmin("OWNER:random-session-id").success', context), false);
});

test('Firebase uses deploying owner OAuth and keeps requests in the school namespace', () => {
  let captured;
  const context = vm.createContext({
    getSchoolMetadata_: () => ({ schoolId: 'SCH001', firebaseDatabaseUrl: 'https://database.example.test' }),
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    CacheService: { getScriptCache: () => ({ get: () => null }) },
    ScriptApp: { getOAuthToken: () => 'owner-oauth' },
    UrlFetchApp: { fetch: (url, options) => { captured = {url, options}; return { getResponseCode: () => 200, getContentText: () => 'null' }; } },
    console,
  });
  vm.runInContext(read('backend/FirebaseService.js'), context);
  assert.equal(vm.runInContext('new FirebaseDatabaseService().requestFirebase_("get", "sesi_siswa/123").success', context), true);
  assert.equal(captured.url, 'https://database.example.test/schools/SCH001/sesi_siswa/123.json');
  assert.equal(captured.options.headers.Authorization, 'Bearer owner-oauth');
});

test('first page initializes the configured spreadsheet once and reuses it', () => {
  const props = new Map();
  const sheet = {};
  let initialized = 0;
  const context = vm.createContext({
    getSchoolMetadata_: () => ({ spreadsheetId: 'configured-sheet' }),
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key,value) => props.set(key,value) }) },
    SpreadsheetApp: { openById: id => { assert.equal(id, 'configured-sheet'); return sheet; }, create: () => assert.fail('must reuse configured spreadsheet') },
  });
  vm.runInContext(read('backend/SetupService.js'), context);
  context.initializeDatabase_ = actual => { assert.equal(actual, sheet); initialized++; };
  assert.equal(context.getOrCreateSpreadsheet_(), sheet);
  assert.equal(context.getOrCreateSpreadsheet_(), sheet);
  assert.equal(initialized, 1);
});

test('all 58 primary button text colors meet WCAG AA contrast', () => {
  const luminance = color => color.slice(1).match(/../g).map(c => parseInt(c,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4).reduce((sum,c,i) => sum+c*[.2126,.7152,.0722][i],0);
  for (const school of JSON.parse(read('config/schools.json'))) {
    const a = luminance(school.theme_primary), b = luminance(school.theme_on_primary);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 4.5, school.school_id);
  }
});

test('backend and embedded frontend scripts parse without syntax errors', () => {
  for (const name of fs.readdirSync(path.join(root,'backend')).filter(name=>name.endsWith('.js'))) new vm.Script(read('backend/'+name), {filename:name});
  for (const name of fs.readdirSync(path.join(root,'frontend')).filter(name=>name.endsWith('.html')&&name!=='Page.html')) {
    for (const match of read('frontend/'+name).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1], {filename:name});
  }
});
