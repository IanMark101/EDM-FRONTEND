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
const { Laboratory } = load(resolve(root, 'app/clinic/[[...path]]/staff-views.tsx'));
const { SignOutDialog } = load(resolve(root, 'components/ui/sign-out-dialog.tsx'));
const { AnalyticsWorkspace } = load(resolve(root, 'app/clinic/[[...path]]/analytics-workspace.tsx'));
const { reportSummary, reportTests } = load(resolve(root, '../shared/analytics.ts'));
const { clinicDay, sanitizePhoneInput, cleanPhone } = load(resolve(root, '../shared/domain.ts'));
const patient = { id: 'P-1', name: 'Practice Patient', dob: '2000-01-01' };
const visit = { id: 'V-1', patientId: 'P-1', date: '2026-01-02', status: 'signed' };
const price = { id: 'PRICE-1', name: 'Consultation', kind: 'consultation', amount: 50000, active: true, updatedBy: 'Clinic Manager', updatedAt: '2026-01-01T00:00:00Z' };
const source = { key: 'visit:V-1', kind: 'consultation', name: 'Consultation', recordId: 'V-1', completedAt: '2026-01-02T00:00:00Z', completedBy: 'Responsible Doctor' };
function data(offerPrice = price) {
  return { user: { role: 'billing' }, patients: [patient], visits: [visit], labs: [], invoices: [], reviews: [], imports: [], facts: [], runs: [], staff: [], history: [], notifications: [], priceList: { version: 1, entries: offerPrice ? [offerPrice] : [] }, billingServices: [{ visitId: visit.id, charges: [{ source, price: offerPrice, alreadyBilled: false }] }] };
}
const render = (modal, workspace = data()) => renderToStaticMarkup(React.createElement(WorkflowDialog, { modal, data: workspace, onClose() {}, async onSaved() {} }));

test('laboratory requests use the clinic test dropdown and require an available service', () => {
  const modal = { kind: 'lab-new', patient, visit };
  const workspace = { ...data(), user: { role: 'doctor' }, labTestNames: ['Blood glucose', 'Custom laboratory service'] };
  const html = render(modal, workspace);
  assert.match(html, /role="combobox"[^>]*aria-expanded="false"[^>]*aria-required="true"/);
  assert.ok(html.includes('Choose a test'));
  assert.match(html, /<button type="submit" class="button button-primary" disabled="">Send request<\/button>/);

  const unavailable = render(modal, { ...workspace, labTestNames: [] });
  assert.ok(unavailable.includes('Ask the account manager to enable the tests'));
  assert.ok(!unavailable.includes('Send request'));
});

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

test('manager screen shows approved prices and laboratory availability controls', () => {
  const html = renderToStaticMarkup(React.createElement(ServicePrices, { data: data(), async reload() {}, notify() {} }));
  assert.ok(html.includes('Service prices')); assert.ok(html.includes('Clinic Manager')); assert.ok(html.includes('500.00')); assert.ok(html.includes('Edit price'));
  assert.ok(html.includes('Laboratory tests doctors can request'));
  assert.ok(html.includes('Complete blood count')); assert.ok(html.includes('Urinalysis'));
  assert.ok(html.includes('Test requests and billing prices are managed separately'));
});

test('an unavailable laboratory work list is distinguished from an empty connected list', () => {
  const workspace = { ...data(), user: { role: 'laboratory' } };
  const offline = renderToStaticMarkup(React.createElement(Laboratory, { data: workspace, open() {}, stale: true }));
  assert.ok(offline.includes('We cannot confirm whether there are new requests yet.'));
  assert.ok(!offline.includes('No reports in this list'));
  assert.ok(!offline.includes('0 requests need completion'));
  const connected = renderToStaticMarkup(React.createElement(Laboratory, { data: workspace, open() {} }));
  assert.ok(connected.includes('No reports in this list'));
});

test('doctor review shows precise laboratory timestamps and a separate optional return time', () => {
  const report = { id: 'L-1', patientId: patient.id, visitId: visit.id, testName: 'Blood glucose', status: 'approved',
    collectedAt: '2026-01-01T16:30:00.000Z', approvedAt: '2026-01-01T16:30:27.643Z', doctorReview: {}, measurements: [], history: [] };
  const workspace = { ...data(), user: { id: 'D-1', role: 'doctor' }, labs: [report] };
  const html = render({ kind: 'lab', row: report }, workspace);
  assert.ok(html.includes('Sample collected')); assert.ok(html.includes('00:30:00'));
  assert.ok(html.includes('Report approved')); assert.ok(html.includes('00:30:27'));
  assert.ok(html.includes('type="date"')); assert.ok(html.includes('type="time"'));
  assert.ok(html.includes('Return time (optional)'));
});

test('saved doctor review displays a return time and preserves earlier date-only records', () => {
  const approvedAt = '2026-01-02T03:00:00Z';
  const report = { id: 'L-1', patientId: patient.id, visitId: visit.id, testName: 'Blood glucose', status: 'approved', approvedAt,
    doctorReview: { reportApprovedAt: approvedAt, reviewedAt: approvedAt, reviewedBy: 'Doctor', plan: 'Reviewed.', followUpDate: '2026-01-10' }, measurements: [], history: [] };
  const workspace = { ...data(), user: { id: 'D-1', role: 'doctor' }, labs: [report] };
  const earlier = render({ kind: 'lab', row: report }, workspace);
  assert.ok(earlier.includes('Return appointment 10 Jan 2026'));
  assert.ok(earlier.includes('Edit return appointment'));
  assert.ok(!earlier.includes('Return appointment 10 Jan 2026 at'));
  const scheduled = render({ kind: 'lab', row: { ...report, doctorReview: { ...report.doctorReview, followUpTime: '09:30' } } }, workspace);
  assert.ok(scheduled.includes('Return appointment 10 Jan 2026 at 09:30'));
  const laboratory = render({ kind: 'lab', row: report }, { ...workspace, user: { role: 'laboratory' } });
  assert.ok(!laboratory.includes('Edit return appointment'));
});

test('signing out requires a separate explicit confirmation and offers a way to stay', () => {
  let confirmed = false;
  const html = renderToStaticMarkup(React.createElement(SignOutDialog, { onClose() {}, async onConfirm() { confirmed = true; } }));
  assert.ok(html.includes('Sign out of CareRecord?')); assert.ok(html.includes('Stay signed in'));
  assert.match(html, /<button[^>]*class="button button-primary"[^>]*>Sign out<\/button>/);
  assert.equal(confirmed, false);
});

function reportingData() {
  const date = clinicDay();
  const fact = (kind, id, extra = {}) => ({ id, kind, date, patientKey: 'P-1', sourceId: id, source: 'Clinic', service: 'Consultation', total: 0, paid: 0, refreshedAt: new Date().toISOString(), ...extra });
  return { ...data(), user: { role: 'reviewer' }, runs: [{ at: new Date().toISOString(), summary: { formatVersion: 2 } }], facts: [
    fact('visit', 'V-1'), fact('visit', 'V-2', { patientKey: 'P-2' }),
    fact('lab', 'L-1', { service: 'Blood glucose' }), fact('lab', 'L-2', { service: 'Blood glucose test' }), fact('lab', 'L-3', { service: 'Blood glucose' }),
    fact('invoice', 'B-1', { total: 75000, paid: 75000 }), fact('payment', 'PAY-1', { paid: 75000 }),
  ] };
}

test('report overview shows the saved figures without loading charts or import controls', () => {
  const html = renderToStaticMarkup(React.createElement(AnalyticsWorkspace, { data: reportingData(), async reload() {}, notify() {} }));
  for (const label of ['Overview', 'Trends', 'Source records', 'Last 14 days', 'Update figures', 'Export report', 'Billing summary']) assert.ok(html.includes(label), label);
  assert.ok(html.includes('750.00')); assert.ok(!html.includes('1,500.00'));
  assert.ok(!html.includes('record-chart')); assert.ok(!html.includes('type="date"'));
  assert.ok(!html.includes('Imports on hold')); assert.ok(!html.includes('Blood glucose test'));
});

test('legacy test names are grouped for display while saved source facts stay intact', () => {
  const workspace = reportingData();
  const original = JSON.stringify(workspace.facts);
  const summary = reportSummary(workspace.facts, clinicDay(), clinicDay());
  assert.deepEqual(JSON.parse(JSON.stringify(reportTests(summary.selected))), [{ name: 'Blood glucose', count: 3 }]);
  assert.equal(summary.visits, 2); assert.equal(summary.labs, 3);
  assert.equal(summary.charged, 75000); assert.equal(summary.received, 75000); assert.equal(summary.due, 0);
  assert.equal(JSON.stringify(workspace.facts), original);
});

test('reporting without a saved snapshot asks for an update instead of showing misleading zero figures', () => {
  const workspace = { ...reportingData(), facts: [], runs: [] };
  const html = renderToStaticMarkup(React.createElement(AnalyticsWorkspace, { data: workspace, async reload() {}, notify() {} }));
  assert.ok(html.includes('Create your first report')); assert.ok(!html.includes('report-metric-label'));
});

test('the removed file-import dialog has no upload or submission controls', () => {
  const html = render({ kind: 'import' }, { ...data(), user: { role: 'laboratory' } });
  assert.ok(html.includes('Record unavailable'));
  assert.ok(!html.includes('type="file"')); assert.ok(!html.includes('Receive records'));
});

test('patient registration enforces 11-digit Philippine mobile formatting and blocks invalid contact numbers', () => {
  assert.equal(sanitizePhoneInput('874651616516565161651651651'), '87465161651');
  assert.throws(() => cleanPhone('87465161651'), /11-digit Philippine mobile number/);
  const workspace = { ...data(), user: { role: 'registration' }, staff: [{ id: 'D-1', name: 'Dr. Ian Mark Buenaflor', role: 'doctor' }] };
  const invalidHtml = render({ kind: 'patient-new', row: { name: 'Ana Reyes', dob: '2002-05-15', phone: '87465161651', doctorId: 'D-1' } }, workspace);
  assert.ok(invalidHtml.includes('Enter an 11-digit Philippine mobile number starting with 09 (or +639).'));
  assert.match(invalidHtml, /maxLength="16"/i);
  assert.match(invalidHtml, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Register patient<\/button>/);

  const validHtml = render({ kind: 'patient-new', row: { name: 'Ana Reyes', dob: '2002-05-15', phone: '0917 123 4567', doctorId: 'D-1' } }, workspace);
  assert.ok(!validHtml.includes('Enter an 11-digit Philippine mobile number starting with 09 (or +639).'));
  assert.doesNotMatch(validHtml, /<button[^>]*disabled=""[^>]*>Register patient<\/button>/);
});
