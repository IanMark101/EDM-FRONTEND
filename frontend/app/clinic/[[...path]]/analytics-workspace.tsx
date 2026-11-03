'use client';
import { useState } from 'react';
import { Download, RefreshCw, Database, ArrowRight, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { Panel, Empty, formatMoney, formatDate, formatTime, PageHeading } from '@/components/ui/common';
import { RecordChart } from '@/components/ui/record-chart';
import { clinicRequest } from '@/app/lib/client';
import { clinicDay } from '@shared/domain';
import { reportSummary } from '@shared/analytics';
import type { WorkspaceData } from './staff-workspace';

export function AnalyticsWorkspace({ data, reload, notify }: { data: WorkspaceData; reload: () => Promise<void>; notify: (s: string) => void }) {
  const initial = new Date(`${clinicDay()}T12:00:00Z`); initial.setUTCDate(initial.getUTCDate() - 13);
  const [from, setFrom] = useState(initial.toISOString().slice(0, 10)); const [to, setTo] = useState(clinicDay());
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [showSources, setShowSources] = useState(false);
  const invalid = !from || !to || from > to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to));
  const result = reportSummary(data.facts, invalid ? '9999' : from, invalid ? '' : to);
  const modern = data.runs[0]?.summary?.formatVersion === 2;
  const daySpan = invalid ? 0 : Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const group = (date: string) => daySpan > 730 ? date.slice(0, 4) : daySpan > 62 ? date.slice(0, 7) : daySpan > 14 ? (() => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); })() : date;
  const buckets: string[] = [];
  if (!invalid) {
    const cursor = new Date(`${from}T12:00:00Z`); if (daySpan > 62) cursor.setUTCDate(1); if (daySpan > 730) cursor.setUTCMonth(0); const last = new Date(`${to}T12:00:00Z`);
    for (let i = 0; cursor <= last && i < 3700; i++) { const key = group(cursor.toISOString().slice(0, 10)); if (!buckets.includes(key)) buckets.push(key); if (daySpan > 730) cursor.setUTCFullYear(cursor.getUTCFullYear() + 1); else if (daySpan > 62) cursor.setUTCMonth(cursor.getUTCMonth() + 1); else cursor.setUTCDate(cursor.getUTCDate() + 1); }
  }
  const dateLabel = (date: string) => date.length === 4 ? date : date.length === 7 ? new Date(`${date}-15T12:00:00Z`).toLocaleString('en-GB', { month: 'short', year: '2-digit' }) : new Date(`${date}T12:00:00Z`).toLocaleString('en-GB', { day: 'numeric', month: 'short' });
  const visits = result.selected.filter(f => f.kind === 'visit');
  const labs = result.selected.filter(f => f.kind === 'lab');
  const payments = result.selected.filter(f => f.kind === 'payment');
  const tests = [...new Set(labs.map(f => f.service))].map(name => ({ name, count: labs.filter(f => f.service === name).length })).sort((a, b) => b.count - a.count);
  async function refresh() {
    setBusy(true); setError('');
    try { await clinicRequest('warehouse/refresh', {}); await reload(); notify('Reporting figures updated from checked records.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'The figures could not be updated.'); }
    finally { setBusy(false); }
  }
  const period = `${formatDate(from)} to ${formatDate(to)}`;
  return <><PageHeading title="Reports & analytics" description="Understand completed care, payments received and the records that need attention." action={<button className="button button-primary" onClick={refresh} disabled={busy}><RefreshCw size={16} className={busy ? 'spinning' : ''} />{busy ? 'Updating figures…' : 'Update figures'}</button>} />
    <div className="analytics-period"><div className="date-fields"><label className="field"><span>From</span><input type="date" value={from} max={to || clinicDay()} onChange={e => setFrom(e.target.value)} /></label><label className="field"><span>To</span><input type="date" value={to} max={clinicDay()} min={from} onChange={e => setTo(e.target.value)} /></label></div><span className="report-freshness">Figures updated {data.runs[0] ? formatTime(data.runs[0].at) : 'not yet'}<small>Selected copies of checked department records</small></span><a className={`button button-secondary ${invalid ? 'disabled-link' : ''}`} href={`/api/reports.csv?from=${from}&to=${to}`} aria-disabled={invalid} onClick={e => { if (invalid) e.preventDefault(); }}><Download size={16} />Export report</a></div>
    {invalid && <p className="form-error" role="alert">Choose a start and end date, with the start on or before the end.</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {!modern && <div className="notice-inline">Update the figures to include payments by the date they were received.</div>}
    <div className="analytics-metrics"><div><span>Completed consultations</span><strong>{result.visits}</strong><small>{result.patients} {result.patients === 1 ? 'patient' : 'patients'} served</small></div><div><span>Approved lab reports</span><strong>{result.labs}</strong><small>By approval date</small></div><div><span>Payments received</span><strong>{modern ? formatMoney(result.received) : '—'}</strong><small>By payment date</small></div><div><span>Current balance</span><strong>{formatMoney(result.due)}</strong><small>For bills dated in this period</small></div></div>
    <div className="analytics-finding"><CircleCheck size={18} /><p>{result.visits ? `${result.visits} completed consultations and ${result.labs} approved reports in this period.` : 'No completed consultations in this period.'}{tests[0] ? ` ${tests[0].name} has the most approved reports (${tests[0].count}).` : ''}</p></div>
    <div className="analytics-chart-grid"><Panel title={`Completed consultations ${daySpan > 730 ? 'by year' : daySpan > 62 ? 'by month' : daySpan > 14 ? 'by week' : 'by day'}`} aside={<span className="muted">By visit date</span>}><RecordChart labels={buckets.map(dateLabel)} values={buckets.map(key => visits.filter(f => group(f.date) === key).length)} label={`Completed consultations, ${period}`} height={190} /></Panel><Panel title="Approved reports by test"><RecordChart labels={tests.map(t => t.name)} values={tests.map(t => t.count)} label={`Approved reports by test, ${period}`} horizontal height={190} />{!tests.length ? <p className="chart-empty">No approved reports in this period.</p> : <p className="source-line">Only approved reports are counted, using their approval date.</p>}</Panel></div>
    <div className="analytics-chart-grid"><Panel title={`Payments received ${daySpan > 730 ? 'by year' : daySpan > 62 ? 'by month' : daySpan > 14 ? 'by week' : 'by day'}`} aside={<span className="muted">PHP · Payment date</span>}><RecordChart labels={buckets.map(dateLabel)} values={buckets.map(key => payments.filter(f => group(f.date) === key).reduce((n, f) => n + f.paid, 0) / 100)} label={`Payments received in Philippine pesos, ${period}`} height={170} money /></Panel><Panel title="Charges and current balances"><dl className="analytics-money"><div><dt>Charges raised in this period</dt><dd>{formatMoney(result.charged)}</dd></div><div><dt>Payments received in this period</dt><dd>{modern ? formatMoney(result.received) : '—'}</dd></div><div><dt>Current balance on included bills</dt><dd>{formatMoney(result.due)}</dd></div></dl><p className="source-line">Balances reflect the last figures update. A payment can be received on a different day from its bill.</p></Panel></div>
    <Panel title="Records needing attention" aside={<Link className="text-link" href="/clinic/review">Open record checks<ArrowRight size={15} /></Link>}><div className="quality-strip"><div><span>Identity questions</span><strong>{data.quality?.identityQuestions || 0}</strong></div><div><span>Incomplete reports</span><strong>{data.quality?.incompleteReports || 0}</strong></div><div><span>Imports on hold</span><strong>{data.quality?.heldImports || 0}</strong></div></div><p className="source-line">Current open work across departments, checked {formatTime(data.quality?.checkedAt)}. These counts are separate measures; a held import may also have an identity question.</p>{data.quality?.invalidApproved > 0 && <p className="notice-inline">{data.quality.invalidApproved} approved reports need a laboratory check. They are excluded from reporting copies.</p>}</Panel>
    <Panel title="Where these figures come from" aside={<button className="text-button" onClick={() => setShowSources(v => !v)}>{showSources ? 'Hide source records' : 'View source records'}</button>}><div className="analytics-source-ledger">{[{ name: 'Clinic', kind: 'visit', caption: 'completed consultations' }, { name: 'Laboratory', kind: 'lab', caption: 'approved reports' }, { name: 'Billing', kind: 'invoice', caption: 'bills' }, { name: 'Payments', kind: 'payment', caption: 'payment entries' }].map(source => <div key={source.kind}><Database size={18} /><span><strong>{source.name}</strong><small>{result.selected.filter(f => f.kind === source.kind).length} {source.caption}</small></span></div>)}</div>
      {showSources && (result.selected.length ? <div className="table-wrap"><table><thead><tr><th>Department</th><th>Original record</th><th>Date</th><th>Included information</th></tr></thead><tbody>{result.selected.map(f => <tr key={f.id}><td data-label="Department">{f.source}</td><td data-label="Original record">{f.sourceId}</td><td data-label="Date">{formatDate(f.date)}</td><td data-label="Included information">{f.service}</td></tr>)}</tbody></table></div> : <Empty title="No reporting copies in this period" />)}
      <p className="source-line">Figures use selected checked copies. Consultation notes, result values and contact details stay in the responsible departments.</p></Panel>
  </>;
}
