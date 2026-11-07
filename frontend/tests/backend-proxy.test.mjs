import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../app/lib/backend.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { backendRequest } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('HTTPS frontend secures every cookie even when the API uses HTTP', async context => {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  headers.append('set-cookie', 'carerecord_session=test; Path=/; HttpOnly; SameSite=Lax');
  headers.append('set-cookie', 'other=test; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/');
  let forwarded;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    forwarded = { url, options }; return new Response('{"ok":true}', { status: 200, headers });
  });
  const response = await backendRequest(new Request('https://clinic.example/api/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://clinic.example', host: 'clinic.example' }, body: '{}' }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const cookies = response.headers.getSetCookie(); assert.equal(cookies.length, 2);
  assert.ok(cookies.every(cookie => cookie.endsWith('; Secure'))); assert.ok(cookies[1].includes('Expires=Wed, 01 Jan 2031'));
  assert.equal(forwarded.options.headers.has('host'), false); assert.equal(forwarded.options.headers.get('origin'), 'https://clinic.example');
  assert.equal(await response.text(), '{"ok":true}');
});
test('local HTTP development keeps non-secure cookies usable', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}', { headers: { 'set-cookie': 'carerecord_session=test; Path=/; HttpOnly' } }));
  const response = await backendRequest(new Request('http://127.0.0.1:3000/api/session'));
  assert.equal(response.headers.getSetCookie()[0], 'carerecord_session=test; Path=/; HttpOnly');
});
test('secure cookie attributes and logout expiration are preserved', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}', { headers: { 'set-cookie': 'carerecord_session=; Path=/; HttpOnly; Max-Age=0; Secure' } }));
  const response = await backendRequest(new Request('https://clinic.example/api/logout', { method: 'POST', body: '{}' }));
  assert.equal(response.headers.getSetCookie()[0], 'carerecord_session=; Path=/; HttpOnly; Max-Age=0; Secure');
});
test('upstream failures return the existing safe unavailable response', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('Internal connection details'); });
  const response = await backendRequest(new Request('http://127.0.0.1:3000/api/data'));
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('Internal connection details'), false);
});

test('a lost upstream save response advises checking records without forwarding twice', async context => {
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => { attempts++; throw new Error('Upstream response lost'); });
  const response = await backendRequest(new Request('http://127.0.0.1:3000/api/service-prices', { method: 'POST', body: '{"amount":"500"}' }));
  assert.equal(response.status, 503); const payload = await response.json();
  assert.equal(payload.code, 'SAVE_NOT_CONFIRMED'); assert.match(payload.error, /check whether your change was saved/); assert.equal(attempts, 1);
});
