import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from './live-school-qa-state.mjs';
test('public sheet snapshots preserve leading-zero IDs, commas, quoted text and multiline values',()=>{
  assert.deepEqual(parseCsv('"NISN","Nama"\r\n"0098000001","QA, Siswa ""satu""\nbaris dua"\r\n'),[['NISN','Nama'],['0098000001','QA, Siswa "satu"\nbaris dua']]);
});
