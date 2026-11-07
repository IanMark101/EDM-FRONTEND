import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../app/lib/client.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { clinicRequest } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('a temporary unavailable GET recovers automatically without changing the request', async context => {
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? Response.json({ error: 'Disconnected' }, { status: 503 }) : Response.json({ version: 2, entries: [] }); });
  assert.equal((await clinicRequest('service-prices')).version, 2); assert.equal(calls.length, 2);
  assert.equal(calls[0].url, calls[1].url); assert.equal(calls[0].options.signal, calls[1].options.signal);
});
test('a lost GET response retries once but ongoing failures stop', async context => {
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => { attempts++; throw new TypeError('Socket closed'); });
  await assert.rejects(clinicRequest('data?refresh=1'), /Try refreshing/); assert.equal(attempts, 2);
});
test('an interrupted save is not resubmitted and asks staff to verify saved records', async context => {
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => { attempts++; throw new TypeError('Socket closed'); });
  await assert.rejects(clinicRequest('invoices/B-1/payment', { amount: '500' }), /could not confirm whether your change was saved/);
  assert.equal(attempts, 1);
});
test('an HTTP 503 on a price change is not automatically replayed', async context => {
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => { attempts++; return Response.json({ error: 'Refresh records to check the saved price.' }, { status: 503 }); });
  await assert.rejects(clinicRequest('service-prices', { amount: '500' }), /check the saved price/); assert.equal(attempts, 1);
});
test('timeouts do not restart a request with a new deadline', async context => {
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => { attempts++; throw new DOMException('Aborted', 'AbortError'); });
  await assert.rejects(clinicRequest('data'), /Refreshing took too long/); assert.equal(attempts, 1);
});

test('the original timeout also covers reading a stalled save response body', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let attempts = 0; let bodyStarted;
  const parsing = new Promise(resolve => { bodyStarted = resolve; });
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    attempts++;
    return { ok: true, status: 200, json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      bodyStarted();
    }) };
  });
  const saved = clinicRequest('service-prices', { amount: '500' });
  const rejected = assert.rejects(saved, /could not confirm whether your change was saved/);
  await parsing;
  context.mock.timers.tick(30_000);
  await rejected;
  assert.equal(attempts, 1);
});
test('validation errors are returned immediately', async context => {
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => { attempts++; return Response.json({ error: 'Price must be positive.' }, { status: 422 }); });
  await assert.rejects(clinicRequest('service-prices', { amount: '0' }), /Price must be positive/); assert.equal(attempts, 1);
});
