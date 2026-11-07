'use client';
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Field, PageHeading, formatMoney, formatTime } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';
import type { WorkspaceData } from './staff-workspace';
import type { ServicePrice, ServicePriceList } from '@shared/billing';

type Draft = { id?: string; kind: ServicePrice['kind']; name: string; amount: string; active: boolean; reason: string; version: number };
export function ServicePrices({ data, reload, notify, onPriceSaved }: { data: WorkspaceData; reload: () => Promise<void>; notify: (text: string) => void; onPriceSaved?: (prices: ServicePriceList) => void }) {
  const prices: ServicePriceList = data.priceList || { version: 0, entries: [] };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  function edit(entry?: ServicePrice) {
    const kind = entry?.kind || (prices.entries.some(price => price.kind === 'consultation') ? 'laboratory' : 'consultation');
    setDraft({ id: entry?.id, kind, name: entry?.name || (kind === 'consultation' ? 'Consultation' : ''), amount: entry ? (entry.amount / 100).toFixed(2) : '', active: entry?.active ?? true, reason: '', version: prices.version }); setError('');
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft || busy) return; setBusy(true); setError('');
    try {
      const saved: ServicePriceList = await clinicRequest('service-prices', draft);
      onPriceSaved?.(saved); setDraft(null); notify('Service price saved. Billing will use it for new charges.');
      void reload();
    }
    catch (error) { setError(error instanceof Error ? error.message : 'The service price could not be saved.'); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title="Service prices" description="Set the clinic-approved amounts that billing uses for completed services." action={<button type="button" className="button button-primary" disabled={busy} onClick={() => edit()}><Plus size={17} />Add service price</button>} />
    <p className="notice-inline">You set the prices. Billing uses them to prepare bills and receive payment. Saved bills keep their original amounts when a price changes.</p>
    {draft && <section className="service-price-editor" aria-labelledby="price-editor-title"><h2 id="price-editor-title">{draft.id ? 'Edit service price' : 'Add service price'}</h2><form onSubmit={save}>
      <div className="form-grid"><Field label="Service type"><select value={draft.kind} disabled={busy} onChange={event => { const kind = event.target.value as Draft['kind']; setDraft({ ...draft, kind, name: kind === 'consultation' ? 'Consultation' : '' }); }}><option value="consultation">Consultation</option><option value="laboratory">Laboratory test</option></select></Field>
      <Field label="Service name" hint="For a test, use the same name that doctors request."><input required list="service-price-names" readOnly={draft.kind === 'consultation'} maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /><datalist id="service-price-names"><option>Complete blood count</option><option>Blood glucose</option><option>Urinalysis</option><option>Cholesterol</option></datalist></Field></div>
      <Field label="Approved price (PHP)"><input type="number" required min="0.01" max="1000000" step="0.01" inputMode="decimal" value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></Field>
      <label className="check-field"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} /><span>Available for new billing charges</span></label>
      {draft.id && <Field label="Reason for the change"><textarea rows={3} required minLength={12} maxLength={1000} value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} /></Field>}
      {error && <div className="form-error" role="alert"><p>{error}</p><button className="text-button" type="button" disabled={busy} onClick={async () => { await reload(); setDraft(null); setError(''); }}>Reload price list</button></div>}
      <div className="form-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => setDraft(null)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save service price'}</button></div>
    </form></section>}
    {prices.entries.length ? <div className="table-wrap"><table><thead><tr><th>Service</th><th>Approved price</th><th>Availability</th><th>Last set by</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{prices.entries.map(price => <tr key={price.id}>
      <td data-label="Service"><strong>{price.name}</strong><small className="price-table-detail">{price.kind === 'consultation' ? 'Consultation' : 'Laboratory test'}</small></td><td data-label="Approved price">{formatMoney(price.amount)}</td><td data-label="Availability">{price.active ? 'Available' : 'Disabled'}</td><td data-label="Last set by">{price.updatedBy}<small className="price-table-detail">{formatTime(price.updatedAt)}</small></td><td data-label="Action"><button type="button" className="text-button" disabled={busy} onClick={() => edit(price)}>Edit price</button></td>
    </tr>)}</tbody></table></div> : <div className="service-prices-empty"><h2>No service prices yet</h2><p>Add the consultation price and each laboratory test price. Billing can use a service after its price is saved here.</p></div>}
  </>;
}
