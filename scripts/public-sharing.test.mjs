import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../backend/SetupService.js',import.meta.url),'utf8');
test('anonymous callers cannot change school sharing',()=>{
  const context=vm.createContext({requireSchoolOwner_(){throw Error('Pemilik diperlukan');},DriveApp:{getFileById(){assert.fail('Drive must not be reached');}}});
  vm.runInContext(source,context);
  assert.throws(()=>context.publishSchoolSpreadsheetForOwner(),/Pemilik diperlukan/);
});
test('owner sharing targets only the configured school spreadsheet and verifies access',()=>{
  let sharing;
  const context=vm.createContext({requireSchoolOwner_(){},getSchoolMetadata_:()=>({schoolId:'SCH007',spreadsheetId:'fixed-school-sheet'}),DriveApp:{Access:{ANYONE_WITH_LINK:'LINK'},Permission:{EDIT:'EDIT'},getFileById(id){assert.equal(id,'fixed-school-sheet');return {setSharing(...args){sharing=args;},getSharingAccess:()=>sharing[0],getSharingPermission:()=>sharing[1]};}}});
  vm.runInContext(source,context);
  const result=context.publishSchoolSpreadsheetForOwner();
  assert.deepEqual(sharing,['LINK','EDIT']);
  assert.equal(result.public_editor,true);
  assert.equal(result.school_id,'SCH007');
});
