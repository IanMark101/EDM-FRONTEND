'use client';
import { useState } from 'react';
import { Download, RefreshCw, Database, ChevronLeft, ChevronRight, Stethoscope, FlaskConical, Wallet, ReceiptText, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Empty, SearchField, formatMoney, formatDate, formatTime, PageHeading } from '@/components/ui/common';
import { RecordChart } from '@/components/ui/record-chart';
import { clinicRequest } from '@/app/lib/client';
import { clinicDay } from '@shared/domain';
import { reportSummary, reportTests } from '@shared/analytics';
import type { WorkspaceData } from './staff-workspace';

type Section = 'overview' | 'trends' | 'records';
type Period = 'today' | 'fortnight' | 'month' | 'custom';
type Trend = 'visits' | 'tests' | 'payments';
const sourceName = (kind: string) => ({ visit: 'Consultation', lab: 'Laboratory', invoice: 'Bill', payment: 'Payment' }[kind] || kind);

export function AnalyticsWorkspace({ data, reload, notify }: { data: WorkspaceData; reload: () => Promise<void>; notify: (message: string) => void }) {
  const today = clinicDay();
  const fortnight = new Date(today + 'T12:00:00Z'); fortnight.setUTCDate(fortnight.getUTCDate() - 13);
  const [from, setFrom] = useState(fortnight.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState<Period>('fortnight');
  const [section, setSection] = useState<Section>('overview');
  const [trend, setTrend] = useState<Trend>('visits');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const invalid = !from || !to || from > to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to));
  const result = reportSummary(data.facts, invalid ? '9999' : from, invalid ? '' : to);
  const lastRun = data.runs[0];
  const modern = lastRun?.summary?.formatVersion === 2;
  const tests = reportTests(result.selected);
  const periodLabel = invalid ? 'Choose valid report dates' : formatDate(from) + (from === to ? '' : ' to ' + formatDate(to));
  const daySpan = invalid ? 0 : Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const interval = daySpan > 730 ? 'year' : daySpan > 62 ? 'month' : daySpan > 14 ? 'week' : 'day';
  const group = (date: string) => interval === 'year' ? date.slice(0, 4) : interval === 'month' ? date.slice(0, 7) : interval === 'week' ? (() => {
    const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7);
    return value.toISOString().slice(0, 10);
  })() : date;
  // Charts are prepared only when that section is opened.
  const buckets: string[] = [];
  if (section === 'trends' && trend !== 'tests' && !invalid) {
    const cursor = new Date(from + 'T12:00:00Z');
    if (daySpan > 62) cursor.setUTCDate(1);
    if (daySpan > 730) cursor.setUTCMonth(0);
    const last = new Date(to + 'T12:00:00Z');
    for (let index = 0; cursor <= last && index < 3700; index++) {
      const key = group(cursor.toISOString().slice(0, 10));
      if (!buckets.includes(key)) buckets.push(key);
      if (daySpan > 730) cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
      else if (daySpan > 62) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const dateLabel = (date: string) => date.length === 4 ? date : date.length === 7
    ? new Date(date + '-15T12:00:00Z').toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    : new Date(date + 'T12:00:00Z').toLocaleString('en-GB', { day: 'numeric', month: 'short' });
  const trendFacts = result.selected.filter(fact => fact.kind === (trend === 'payments' ? 'payment' : 'visit'));
  const search = query.trim().toLowerCase();
  const records = result.selected.filter(fact => [fact.id, fact.sourceId, fact.service, sourceName(fact.kind)].some(value => String(value || '').toLowerCase().includes(search)));
  const pages = Math.max(1, Math.ceil(records.length / 20));
  const currentPage = Math.min(page, pages);
  const rows = records.slice((currentPage - 1) * 20, currentPage * 20);
  function choosePeriod(next: Period) {
    setPeriod(next); setPage(1);
    if (next === 'custom') return;
    setTo(today);
    setFrom(next === 'today' ? today : next === 'month' ? today.slice(0, 7) + '-01' : fortnight.toISOString().slice(0, 10));
  }
  async function refresh() {
    if (busy) return;
    setBusy(true); setError('');
    try { await clinicRequest('warehouse/refresh', {}); await reload(); notify('Reporting figures updated from checked records.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The figures could not be updated.'); }
    finally { setBusy(false); }
  }
  const sections = [{ id: 'overview', label: 'Overview' }, { id: 'trends', label: 'Trends' }, { id: 'records', label: 'Source records' }] as const;
  const metrics = [
    { label: 'Completed consultations', value: result.visits, detail: result.patients + (result.patients === 1 ? ' patient served' : ' patients served'), Icon: Stethoscope },
    { label: 'Approved lab reports', value: result.labs, detail: 'By approval date', Icon: FlaskConical },
    { label: 'Payments received', value: modern ? formatMoney(result.received) : '—', detail: 'By payment date', Icon: Wallet },
    { label: 'Current balance', value: formatMoney(result.due), detail: 'For bills in this period', Icon: ReceiptText },
  ];
  return <div className="reports-workspace">
    <PageHeading title="Reports & analytics" description="Completed care and payments, in one clear view." action={
      <button type="button" className="button button-primary" onClick={() => void refresh()} disabled={busy}>
        <RefreshCw size={16} className={busy ? 'spinning' : ''} aria-hidden="true" />{busy ? 'Updating figures…' : 'Update figures'}
      </button>
    } />
    <div className="report-period-bar">
      <div className="report-period-options" role="group" aria-label="Report period">
        {([{ id: 'today', label: 'Today' }, { id: 'fortnight', label: 'Last 14 days' }, { id: 'month', label: 'This month' }, { id: 'custom', label: 'Custom dates' }] as const).map(option =>
          <button key={option.id} type="button" aria-pressed={period === option.id} onClick={() => choosePeriod(option.id)}>{option.label}</button>)}
      </div>
      <a className="button button-secondary" href={invalid ? undefined : '/api/reports.csv?from=' + from + '&to=' + to}
        aria-disabled={invalid} tabIndex={invalid ? -1 : undefined} onClick={event => { if (invalid) event.preventDefault(); }}>
        <Download size={16} aria-hidden="true" />Export report
      </a>
    </div>
    {period === 'custom' && <div className="report-custom-dates">
      <label className="field"><span>From</span><input type="date" value={from} max={to || today} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label>
      <label className="field"><span>To</span><input type="date" value={to} max={today} min={from} onChange={event => { setTo(event.target.value); setPage(1); }} /></label>
    </div>}
    <div className="report-context"><span>{periodLabel}</span><span>{lastRun ? <>Figures updated <time dateTime={lastRun.at}>{formatTime(lastRun.at)}</time></> : 'No saved report yet'}</span></div>
    {invalid && <p className="form-error" role="alert">Choose a start and end date, with the start on or before the end.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="work-tabs report-sections" role="group" aria-label="Report sections">{sections.map(item =>
      <button type="button" key={item.id} aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>
    {!invalid && !lastRun && <div className="report-first-use"><Database size={25} aria-hidden="true" /><h2>Create your first report</h2><p>Select Update figures to prepare a report from completed consultations, approved tests and billing.</p></div>}
    {!invalid && lastRun && <>
      {section === 'overview' && <>
        <div className="report-metrics">{metrics.map(({ label, value, detail, Icon }) => <div className="report-metric" key={label}>
          <span className="report-metric-label"><Icon size={17} aria-hidden="true" />{label}</span><strong>{value}</strong><small>{detail}</small>
        </div>)}</div>
        {!modern && <p className="notice-inline">Select Update figures to include payments by the date they were received.</p>}
        <div className="report-overview-grid">
          <section className="report-overview-section" aria-labelledby="report-tests-title">
            <h2 id="report-tests-title">Approved tests</h2>
            {tests.length ? <ul className="report-test-list">{tests.map(test => <li key={test.name}><span>{test.name}</span><strong>{test.count}<small>{test.count === 1 ? 'report' : 'reports'}</small></strong></li>)}</ul>
              : <p className="report-empty-note">No approved lab reports in these dates.</p>}
          </section>
          <section className="report-overview-section" aria-labelledby="report-money-title">
            <h2 id="report-money-title">Billing summary</h2>
            <dl className="report-money"><div><dt>Charges raised</dt><dd>{formatMoney(result.charged)}</dd></div><div><dt>Payments received</dt><dd>{modern ? formatMoney(result.received) : '—'}</dd></div><div><dt>Still to collect</dt><dd>{formatMoney(result.due)}</dd></div></dl>
            <p className="report-empty-note">A payment can be received on a different day from its bill.</p>
          </section>
        </div>
      </>}
      {section === 'trends' && <section className="report-trend-section" aria-labelledby="report-trend-title">
        <div className="report-trend-heading"><h2 id="report-trend-title">{trend === 'tests' ? 'Approved reports by test' : (trend === 'payments' ? 'Payments received' : 'Completed consultations') + ' by ' + interval}</h2>
          <div className="report-trend-options" role="group" aria-label="Chart to display">{([{ id: 'visits', label: 'Consultations' }, { id: 'tests', label: 'Lab tests' }, { id: 'payments', label: 'Payments' }] as const).map(option =>
            <button type="button" key={option.id} aria-pressed={trend === option.id} onClick={() => setTrend(option.id)}>{option.label}</button>)}</div>
        </div>
        {trend === 'payments' && !modern ? <p className="report-empty-note">Update figures to view payments by the date they were received.</p> : (trend === 'tests' ? tests.length > 0 : trendFacts.length > 0)
          ? <RecordChart labels={trend === 'tests' ? tests.map(test => test.name) : buckets.map(dateLabel)}
            values={trend === 'tests' ? tests.map(test => test.count) : buckets.map(key => trendFacts.filter(fact => group(fact.date) === key).reduce((sum, fact) => sum + (trend === 'payments' ? fact.paid / 100 : 1), 0))}
            label={(trend === 'payments' ? 'Payments received in Philippine pesos' : trend === 'tests' ? 'Approved reports by test' : 'Completed consultations') + ', ' + periodLabel}
            horizontal={trend === 'tests'} height={240} money={trend === 'payments'} />
          : <p className="report-empty-note">No {trend === 'tests' ? 'approved reports' : trend === 'payments' ? 'payments' : 'completed consultations'} in these dates.</p>}
      </section>}
      {section === 'records' && <section className="report-record-section" aria-labelledby="report-records-title">
        <div className="report-records-heading"><div><h2 id="report-records-title">Where these figures come from</h2><p>Checked reporting copies. Clinical notes and result values stay in their own records.</p></div><span>{query ? records.length + ' of ' : ''}{result.selected.length} records</span></div>
        <div className="report-record-search"><SearchField label="Find a record number or service" value={query} onChange={value => { setQuery(value); setPage(1); }} /></div>
        {rows.length ? <div className="table-wrap"><table><thead><tr><th>Record</th><th>Original number</th><th>Date</th><th>Service</th></tr></thead><tbody>{rows.map(fact => <tr key={fact.id}>
          <td data-label="Record">{sourceName(fact.kind)}</td><td data-label="Original number">{fact.sourceId || fact.id}</td><td data-label="Date">{formatDate(fact.date)}</td><td data-label="Service">{fact.service}</td>
        </tr>)}</tbody></table></div> : <Empty title={query ? 'No matching records' : 'No reporting copies in these dates'} />}
        {pages > 1 && <div className="report-record-pages"><span>Page {currentPage} of {pages}</span><div><button type="button" className="button button-secondary" aria-label="Previous records page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} aria-hidden="true" /></button><button type="button" className="button button-secondary" aria-label="Next records page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} aria-hidden="true" /></button></div></div>}
        <details className="report-method"><summary>How Update figures works</summary><ol><li><strong>Extract:</strong> read consultation, laboratory, bill and payment records.</li><li><strong>Transform:</strong> check record links and prepare eligible records in a shared reporting format.</li><li><strong>Load:</strong> save the checked copies in the reporting tables used here.</li></ol><p>Draft consultations and incomplete or unapproved lab reports are excluded. Changing the date filter does not run this update.</p></details>
      </section>}
    </>}
    <footer className="report-footer"><p>Figures reflect the last update. Use Update figures after staff save new work.</p><Link className="text-link" href="/clinic/review">Open record checks<ArrowRight size={15} aria-hidden="true" /></Link></footer>
  </div>;
}
