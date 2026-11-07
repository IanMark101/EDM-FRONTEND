import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the actual components with their normal shared UI. This uses no browser,
// clinic API, credentials or installed database, and adds no test dependencies.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map();
function load(filename) {
  const path = [filename, `${filename}.ts`, `${filename}.tsx`].find(path => existsSync(path));
  assert.ok(path, `Missing test source: ${filename}`);
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} }; modules.set(path, module);
  const nativeRequire = createRequire(path);
  const require = specifier => specifier.startsWith('@/') ? load(resolve(root, specifier.slice(2)))
    : specifier.startsWith('@shared/') ? load(resolve(root, '../shared', specifier.slice(8)))
      : specifier.startsWith('.') ? load(resolve(dirname(path), specifier)) : nativeRequire(specifier);
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: path })(require, module, module.exports);
  return module.exports;
}
const { WorkflowDialog } = load(resolve(root, 'app/clinic/[[...path]]/workflow-dialog.tsx'));
const { ServicePrices } = load(resolve(root, 'app/clinic/[[...path]]/service-prices.tsx'));
const patient = { id: 'P-1', name: 'Practice Patient', dob: '2000-01-01' };
const visit = { id: 'V-1', patientId: 'P-1', date: '2026-01-02', status: 'signed' };
const price = { id: 'PRICE-1', name: 'Consultation', kind: 'consultation', amount: 50000, active: true, updatedBy: 'Clinic Manager', updatedAt: '2026-01-01T00:00:00Z' };
const source = { key: 'visit:V-1', kind: 'consultation', name: 'Consultation', recordId: 'V-1', completedAt: '2026-01-02T00:00:00Z', completedBy: 'Responsible Doctor' };
function data(offerPrice = price) {
  return { user: { role: 'billing' }, patients: [patient], visits: [visit], labs: [], invoices: [], reviews: [], imports: [], facts: [], runs: [], staff: [], history: [], notifications: [], priceList: { version: 1, entries: offerPrice ? [offerPrice] : [] }, billingServices: [{ visitId: visit.id, charges: [{ source, price: offerPrice, alreadyBilled: false }] }] };
}
const render = (modal, workspace = data()) => renderToStaticMarkup(React.createElement(WorkflowDialog, { modal, data: workspace, onClose() {}, async onSaved() {} }));

test('bill preparation displays the completed service and manager price without editable charges', () => {
  const html = render({ kind: 'invoice-new', patient, visit });
  assert.ok(html.includes('V-1')); assert.ok(html.includes('Responsible Doctor')); assert.ok(html.includes('Clinic Manager')); assert.ok(html.includes('500.00'));
  assert.ok(!html.includes('type="number"')); assert.ok(!html.includes('Add service'));
  assert.match(html, /<button class="button button-primary">Create bill<\/button>/);
});

test('missing service prices explain who must set them and block bill creation', () => {
  const html = render({ kind: 'invoice-new', patient, visit }, data(null));
  assert.ok(html.includes('Ask the account manager')); assert.ok(html.includes('Price needed'));
  assert.match(html, /<button class="button button-primary" disabled="">Create bill<\/button>/);
});

test('existing bill view retains payment controls and shows saved charge provenance', () => {
  const row = { id: 'B-1', patientId: patient.id, visitId: visit.id, total: 50000, paid: 10000, payments: [], items: [{ description: 'Consultation', amount: 50000, source, price: { id: price.id, name: price.name, amount: price.amount, setBy: 'Original Manager', setAt: price.updatedAt }, addedBy: 'Cashier' }] };
  const html = render({ kind: 'invoice', row });
  assert.ok(html.includes('Original Manager')); assert.ok(html.includes('Amount received (PHP)')); assert.ok(html.includes('Record payment')); assert.ok(html.includes('Add completed services'));
});

test('older bills remain payable and do not invent missing historical sources', () => {
  const row = { id: 'B-OLD', patientId: patient.id, visitId: visit.id, total: 10000, paid: 0, payments: [], items: [{ description: 'Older service', amount: 10000 }] };
  const html = render({ kind: 'invoice', row }, data(null));
  assert.ok(html.includes('references were not recorded')); assert.ok(html.includes('Record payment')); assert.ok(html.includes('100.00'));
});

test('manager screen shows approved prices and explains that existing bills keep their amounts', () => {
  const html = renderToStaticMarkup(React.createElement(ServicePrices, { data: data(), async reload() {}, notify() {} }));
  assert.ok(html.includes('Service prices')); assert.ok(html.includes('Clinic Manager')); assert.ok(html.includes('500.00')); assert.ok(html.includes('Saved bills keep their original amounts'));
});
