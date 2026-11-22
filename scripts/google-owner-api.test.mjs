import test from 'node:test';
import assert from 'node:assert/strict';
import { findGoogleOwnerCredentials } from './google-owner-api.mjs';

test('uses the matching named account without loading the default account', async () => {
  const selected = { email: 'second@example.com' };
  const calls = [];
  const credentials = await findGoogleOwnerCredentials('second@example.com', {
    initAuth: async ({userKey}) => { calls.push(userKey); return {credentials:selected}; },
    getUserInfo: async item => item,
  });
  assert.equal(credentials, selected);
  assert.deepEqual(calls, ['second@example.com']);
});

test('keeps the existing default account usable for the first account', async () => {
  const selected = { email: 'first@example.com' };
  const credentials = await findGoogleOwnerCredentials('first@example.com', {
    initAuth: async ({userKey}) => ({credentials:userKey==='default'?selected:undefined}),
    getUserInfo: async item => item,
  });
  assert.equal(credentials, selected);
});

test('rejects a named profile logged into the wrong Google account', async () => {
  await assert.rejects(findGoogleOwnerCredentials('second@example.com', {
    initAuth: async () => ({credentials:{email:'first@example.com'}}),
    getUserInfo: async item => item,
  }), /clasp login --user second@example.com/);
});
