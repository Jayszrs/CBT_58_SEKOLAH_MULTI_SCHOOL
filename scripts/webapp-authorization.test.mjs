import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAuthorizationUrl,inspectWebAppHtml} from './webapp-authorization.mjs';
const owner='owner@example.com';
const scopes=['https://www.googleapis.com/auth/spreadsheets'];
const url = new URL('https://accounts.google.com/o/oauth2/auth');
url.searchParams.set('redirect_uri','https://script.google.com/oauthcallback');
url.searchParams.set('login_hint',owner);
url.searchParams.set('scope',scopes[0]);
const html = value => `<title>Authorization needed</title><script>window.open('${value.replaceAll('/','\\/').replaceAll('=','\\x3d').replaceAll('&','\\x26')}');</script>`;

test('extracts the Google permission handoff without evaluating JavaScript',()=>{
  assert.equal(extractAuthorizationUrl(html(url.href),owner,scopes),url.href);
});
test('rejects a lookalike authorization host',()=>{
  assert.throws(()=>extractAuthorizationUrl(html(url.href.replace('accounts.google.com','accounts.google.com.example.test')),owner,scopes),/URL tidak sesuai/);
});
test('rejects another owner email',()=>{
  assert.throws(()=>extractAuthorizationUrl(html(url.href),'another@example.com',scopes),/Email otorisasi/);
});
test('rejects scopes not declared by the application',()=>{
  assert.throws(()=>extractAuthorizationUrl(html(url.href),owner,[]),/Scope otorisasi/);
});
test('distinguishes the real application from an authorization screen',()=>{
  const school={school_name:'SDN TEST',account_email:owner};
  assert.equal(inspectWebAppHtml('<title>CBT | SDN TEST</title>const APP_GLOBAL_CONFIG = {};',school,scopes).status,'APP_RENDERED');
  assert.equal(inspectWebAppHtml(html(url.href),school,scopes).status,'AUTHORIZATION_REQUIRED');
  assert.equal(inspectWebAppHtml('<title>Google Drive</title>',school,scopes).status,'UNEXPECTED_PAGE');
});
