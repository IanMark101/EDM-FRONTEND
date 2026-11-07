'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, FlaskConical, LogOut, ReceiptText, RefreshCw } from 'lucide-react';
import { Brand, Empty, PageHeading, formatDate, formatMoney, formatTime } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';

type RecordSet = {
  patient: { id: string; name: string };
  visits: { id: string; date: string; doctor: string }[];
  labs: { id: string; visitId: string; testName: string; collectedAt: string; releasedAt: string; followUpDate?: string; measurements: { name: string; result: string; unit: string; reference?: string; flag?: string }[] }[];
  bills: { id: string; visitId: string; date: string; total: number; paid: number; items: { description: string; amount: number }[]; payments: { amount: number; method: string; at: string }[] }[];
};
const tabs = [{ id: 'visits', title: 'Visits', Icon: CalendarDays }, { id: 'labs', title: 'Lab results', Icon: FlaskConical }, { id: 'bills', title: 'Bills & payments', Icon: ReceiptText }] as const;

export function PatientRecords() {
  const [data, setData] = useState<RecordSet | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('visits');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      const records: RecordSet = await clinicRequest('patient-portal');
      if (sequence === requestSequence.current) setData(records);
    } catch (error) {
      if (sequence === requestSequence.current) setError(error instanceof Error ? error.message : 'Unable to load your records.');
    } finally { if (sequence === requestSequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const onRestore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', onRestore);
    return () => { requestSequence.current++; window.removeEventListener('pageshow', onRestore); };
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const timer = window.setTimeout(() => { setData(null); window.location.assign('/patient?expired=1'); }, 20 * 60_000);
    return () => window.clearTimeout(timer);
  }, [data]);
  async function logout() {
    requestSequence.current++; setData(null); setSigningOut(true); setLoading(false); setError('');
    try { await clinicRequest('patient-portal/logout', {}); window.location.assign('/patient'); }
    catch { setSigningOut(false); setError('Sign-out did not finish. Try signing out again.'); }
  }
  return <div className="patient-portal">
    <header className="patient-portal-header"><Brand /><button type="button" className="button button-secondary" onClick={logout} disabled={signingOut}><LogOut size={16} aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}</button></header>
    <main className="patient-portal-sheet">
      <PageHeading title="My care records" description={data ? `${data.patient.name} · ${data.patient.id}` : 'CareRecord patient portal'} action={data && <button type="button" className="button button-secondary" onClick={load} disabled={loading}><RefreshCw size={16} aria-hidden="true" />Refresh records</button>} />
      {error && <p className="form-error" role="alert">{error}{!data && loading === false && !error.startsWith('Sign-out') && <button type="button" className="text-button" onClick={load}>Try again</button>}</p>}
      {loading && !data && <p role="status" className="muted">Loading your records…</p>}
      {data && <>
        <div className="work-tabs" role="group" aria-label="My records">{tabs.map(({ id, title, Icon }) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16} aria-hidden="true" />{title}<span>{data[id].length}</span></button>)}</div>
        {tab === 'visits' && (data.visits.length ? <div className="portal-list">{data.visits.map(visit => <article className="portal-record" key={visit.id}><h2>{formatDate(visit.date)}</h2><p>{visit.doctor} · Visit {visit.id}</p><span className="status status-good">Completed</span></article>)}</div> : <Empty title="No completed visits yet" detail="Your completed visits will appear here." />)}
        {tab === 'labs' && (data.labs.length ? <div className="portal-list">{data.labs.map(lab => <details className="portal-record" key={lab.id}>
          <summary><strong>{lab.testName}</strong><span>Released {formatTime(lab.releasedAt)} · Visit {lab.visitId}</span></summary>
          <p>Sample collected {formatTime(lab.collectedAt)}</p>
          <dl className="portal-values">{lab.measurements.map((row, index) => <div key={`${row.name}:${index}`}><dt>{row.name}{row.reference && <small>Reference {row.reference}</small>}</dt><dd>{row.result} {row.unit === 'Not applicable' ? '' : row.unit}{row.flag && <small>{row.flag}</small>}</dd></div>)}</dl>
          {lab.followUpDate && <p>Follow-up date {formatDate(lab.followUpDate)}</p>}
        </details>)}</div> : <Empty title="No released results yet" detail="A laboratory result appears here after your doctor reviews and releases it." />)}
        {tab === 'bills' && (data.bills.length ? <div className="portal-list">{data.bills.map(bill => <details className="portal-record" key={bill.id}>
          <summary><strong>Bill {bill.id}</strong><span>{formatDate(bill.date)} · Visit {bill.visitId}</span></summary>
          <dl className="portal-values">{bill.items.map((item, index) => <div key={index}><dt>{item.description}</dt><dd>{formatMoney(item.amount)}</dd></div>)}<div><dt>Total charges</dt><dd>{formatMoney(bill.total)}</dd></div><div><dt>Payments received</dt><dd>{formatMoney(bill.paid)}</dd></div><div className="portal-balance"><dt>Remaining balance</dt><dd>{formatMoney(Math.max(0, bill.total - bill.paid))}</dd></div></dl>
          {bill.payments.length > 0 && <><h3>Payment history</h3><dl className="portal-values">{bill.payments.map((payment, index) => <div key={index}><dt>{formatTime(payment.at)} · {payment.method}</dt><dd>{formatMoney(payment.amount)}</dd></div>)}</dl></>}
        </details>)}</div> : <Empty title="No bills yet" detail="Bills appear here after the clinic prepares them." />)}
      </>}
    </main>
  </div>;
}
