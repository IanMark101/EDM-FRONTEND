'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { Empty, Field, PageHeading, SearchField, formatTime } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';
import { ROLE_NAMES, type Role } from '@shared/domain';
import type { WorkspaceData } from './staff-workspace';

const emptyFilters = { q: '', role: '', action: '', from: '', to: '' };
type HistoryPage = { entries: { id: string; action: string; actor: string; entityId: string; at: string; detail: string; role: string }[]; total: number; page: number; pages: number; pageSize: number; roles: string[]; actions: string[] };
const roleName = (role: string) => ROLE_NAMES[role as Role] || ({ system: 'System', patient: 'Patient' } as Record<string, string>)[role] || role;

export function ActivityHistory({ data }: { data: WorkspaceData }) {
  const [draft, setDraft] = useState(emptyFilters);
  const [request, setRequest] = useState({ ...emptyFilters, page: 1, pageSize: 20 });
  const [result, setResult] = useState<HistoryPage | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true; setLoading(true); setError('');
    const params = new URLSearchParams();
    Object.entries(request).forEach(([key, value]) => { if (value !== '') params.set(key, String(value)); });
    clinicRequest(`history?${params}`).then((next: HistoryPage) => { if (current) setResult(next); })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : 'Activity history could not be loaded.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [request, data.generatedAt, attempt]);
  const invalidDates = !!(draft.from && draft.to && draft.from > draft.to);
  const filtered = [request.q, request.role, request.action, request.from, request.to].some(Boolean);
  function apply(event: FormEvent) {
    event.preventDefault(); if (invalidDates) return;
    setRequest({ ...request, ...draft, q: draft.q.trim(), page: 1 });
  }
  function clear() { setDraft(emptyFilters); setRequest({ ...emptyFilters, page: 1, pageSize: request.pageSize }); }
  const start = result?.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = result ? start ? start + result.entries.length - 1 : 0 : 0;
  return <>
    <PageHeading title="Activity history" description={data.user.role === 'manager' ? 'Staff access, sign-ins and approved price changes.' : 'Who accessed, changed, approved or exported records, and when.'} />
    <form className="history-filters" onSubmit={apply} aria-label="Filter activity history">
      <div className="history-search"><SearchField value={draft.q} onChange={q => setDraft({ ...draft, q })} label="Find a staff member, action or record" /><span className="muted">Newest activity first</span></div>
      <div className="history-filter-fields">
        <Field label="Role"><select value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })}><option value="">All roles</option>{(result?.roles || []).map(role => <option value={role} key={role}>{roleName(role)}</option>)}</select></Field>
        <Field label="Action"><select value={draft.action} onChange={event => setDraft({ ...draft, action: event.target.value })}><option value="">All actions</option>{(result?.actions || []).map(action => <option value={action} key={action}>{action}</option>)}</select></Field>
        <Field label="From date"><input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></Field>
        <Field label="To date" error={invalidDates ? 'Choose a date on or after the from date.' : undefined}><input type="date" value={draft.to} min={draft.from || undefined} onChange={event => setDraft({ ...draft, to: event.target.value })} /></Field>
      </div>
      <div className="history-filter-actions"><button type="submit" className="button button-primary" disabled={loading || invalidDates}><ListFilter size={16} aria-hidden="true" />Apply filters</button><button type="button" className="text-button" onClick={clear} disabled={loading}>Clear filters</button><span className="muted">Dates use clinic time (UTC+8).</span></div>
    </form>
    {error && <div className="form-error" role="alert"><p>{error}{result ? ' The last loaded entries remain visible.' : ''}</p><button className="text-button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    <div className="history-pagination">
      <div className="history-result-count" role="status">{loading ? 'Loading history…' : result ? `${start}–${end} of ${result.total} ${filtered ? 'matching ' : ''}entries` : 'History unavailable'}</div>
      <label className="history-page-size">Per page<select aria-label="Entries per page" value={request.pageSize} disabled={loading} onChange={event => setRequest({ ...request, page: 1, pageSize: Number(event.target.value) })}>{[10, 20, 50].map(size => <option value={size} key={size}>{size}</option>)}</select></label>
      <nav aria-label="Activity history pages"><button type="button" className="button button-secondary" aria-label="Previous page" disabled={loading || !result || result.page <= 1} onClick={() => setRequest({ ...request, page: result!.page - 1 })}><ChevronLeft size={16} aria-hidden="true" />Previous</button><span>Page {result?.page || 1} of {result?.pages || 1}</span><button type="button" className="button button-secondary" aria-label="Next page" disabled={loading || !result || result.page >= result.pages} onClick={() => setRequest({ ...request, page: result!.page + 1 })}>Next<ChevronRight size={16} aria-hidden="true" /></button></nav>
    </div>
    <div className="activity-list" aria-busy={loading}>
      {result?.entries.map(row => <details className="history-row" key={row.id}><summary><span className="history-dot" aria-hidden="true" /><span><strong>{row.action}</strong><small>{row.actor} · {row.entityId}</small></span><time dateTime={row.at}>{formatTime(row.at)}</time></summary><div className="history-detail"><p>{row.detail}</p><small>{roleName(row.role)}</small></div></details>)}
      {!result && loading && <div className="history-loading" aria-hidden="true">{[0, 1, 2, 3].map(row => <div key={row}><span /><span /></div>)}</div>}
      {!loading && result?.total === 0 && <Empty title="No matching activity" detail="Try another search, adjust the dates or clear the filters." />}
    </div>
  </>;
}
