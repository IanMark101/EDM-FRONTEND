'use client';
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Field, PageHeading, formatMoney, formatTime } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';
import { cleanDescriptiveLabel, moneyCents, sanitizeDecimalInput } from '@shared/domain';
import type { WorkspaceData } from './staff-workspace';
import { labTestCatalog, serviceNameKey, type ServicePrice, type ServicePriceList } from '@shared/billing';

type Draft = { id?: string; kind: ServicePrice['kind']; name: string; amount: string; active: boolean; reason: string; version: number };
export function ServicePrices({ data, reload, notify, onPriceSaved }: { data: WorkspaceData; reload: () => Promise<void>; notify: (text: string) => void; onPriceSaved?: (prices: ServicePriceList) => void }) {
  const prices: ServicePriceList = data.priceList || { version: 0, entries: [] };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const tests = labTestCatalog(prices);
  function edit(entry?: ServicePrice, testName?: string) {
    const kind = entry?.kind || (testName || prices.entries.some(price => price.kind === 'consultation') ? 'laboratory' : 'consultation');
    setDraft({ id: entry?.id, kind, name: entry?.name || testName || (kind === 'consultation' ? 'Consultation' : ''), amount: entry ? (entry.amount / 100).toFixed(2) : '', active: entry?.active ?? true, reason: '', version: prices.version }); setError('');
  }
  async function availability(name: string, available: boolean) {
    if (busy) return; setBusy(true); setError('');
    try {
      const saved: ServicePriceList = await clinicRequest('service-prices', { action: 'lab-availability', name, available, version: prices.version });
      onPriceSaved?.(saved); notify(available ? 'Test enabled. Doctors can request it.' : 'Test hidden from new requests. Existing reports are kept.');
      void reload();
    } catch (error) { setError(error instanceof Error ? error.message : 'Test availability could not be saved.'); }
    finally { setBusy(false); }
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
  const nameError = draft?.kind === 'laboratory' && draft.name.trim() ? (() => {
    try {
      const clean = cleanDescriptiveLabel(draft.name, 'Service name', 120);
      if (prices.entries.some(e => e.id !== draft.id && e.kind === 'laboratory' && serviceNameKey(e.name) === serviceNameKey(clean))) {
        return 'This service already has a price. Edit its existing entry.';
      }
      return '';
    } catch (e) { return e instanceof Error ? e.message : 'Enter a valid service name.'; }
  })() : '';
  const amountError = draft?.amount.trim() ? (() => { try { moneyCents(draft.amount, 'Service price'); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid price.'; } })() : '';
  const reasonShort = !!draft?.id && draft.reason.trim().length > 0 && draft.reason.trim().length < 12;
  const priceBlocked = !draft || !draft.name.trim() || !!nameError || !draft.amount.trim() || !!amountError || (!!draft.id && draft.reason.trim().length < 12);
  return <>
    <PageHeading title="Service prices" description="Set the clinic-approved amounts that billing uses for completed services." action={<button type="button" className="button button-primary" disabled={busy} onClick={() => edit()}><Plus size={17} />Add service price</button>} />
    {!draft && error && <div className="form-error" role="alert"><p>{error}</p><button className="text-button" type="button" disabled={busy} onClick={async () => { await reload(); setError(''); }}>Reload list</button></div>}
    {draft && <section className="service-price-editor" aria-labelledby="price-editor-title"><h2 id="price-editor-title">{draft.id ? 'Edit service price' : 'Add service price'}</h2><form onSubmit={save}>
      <div className="form-grid"><Field label="Service type"><select value={draft.kind} disabled={busy || !!draft.id} onChange={event => { const kind = event.target.value as Draft['kind']; setDraft({ ...draft, kind, name: kind === 'consultation' ? 'Consultation' : '' }); }}><option value="consultation">Consultation</option><option value="laboratory">Laboratory test</option></select></Field>
      <Field label="Service name" hint={draft.kind === 'laboratory' ? 'Choose an existing test name or enter another test your clinic offers.' : undefined} error={nameError || undefined}><input required list="service-price-names" readOnly={draft.kind === 'consultation'} placeholder={draft.kind === 'laboratory' ? 'e.g. Blood glucose or Fecalysis' : undefined} maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /><datalist id="service-price-names">{tests.map(test => <option key={test.name} value={test.name} />)}</datalist></Field></div>
      <Field label="Approved price (PHP)" error={amountError || undefined}><input type="text" inputMode="decimal" placeholder="e.g. 250.00" required maxLength={10} value={draft.amount} onChange={event => setDraft({ ...draft, amount: sanitizeDecimalInput(event.target.value, 2, 7) })} /></Field>
      <label className="check-field"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} /><span>Available for new billing charges</span></label>
      {draft.id && <Field label="Reason for the change" error={reasonShort ? 'Explain the price change in at least 12 characters.' : undefined}><textarea rows={3} required minLength={12} maxLength={1000} value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} /></Field>}
      {error && <div className="form-error" role="alert"><p>{error}</p><button className="text-button" type="button" disabled={busy} onClick={async () => { await reload(); setDraft(null); setError(''); }}>Reload price list</button></div>}
      <div className="form-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => setDraft(null)}>Cancel</button><button className="button button-primary" disabled={busy || priceBlocked}>{busy ? 'Saving…' : 'Save service price'}</button></div>
    </form></section>}
    {prices.entries.length ? <div className="table-wrap"><table><thead><tr><th>Service</th><th>Approved price</th><th>Availability</th><th>Last set by</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{prices.entries.map(price => <tr key={price.id}>
      <td data-label="Service"><strong>{price.name}</strong><small className="price-table-detail">{price.kind === 'consultation' ? 'Consultation' : 'Laboratory test'}</small></td><td data-label="Approved price">{formatMoney(price.amount)}</td><td data-label="Availability">{price.active ? 'Available' : 'Disabled'}</td><td data-label="Last set by">{price.updatedBy}<small className="price-table-detail">{formatTime(price.updatedAt)}</small></td><td data-label="Action"><button type="button" className="text-button" disabled={busy} onClick={() => edit(price)}>Edit price</button></td>
    </tr>)}</tbody></table></div> : <div className="service-prices-empty"><h2>No service prices yet</h2><p>Add the consultation price and each laboratory test price. Billing can use a service after its price is saved here.</p></div>}
    <details className="lab-catalog-settings">
      <summary>Laboratory tests doctors can request <span>{tests.filter(test => test.available).length} enabled</span></summary>
      <p>Enable only the tests this clinic offers. Test requests and billing prices are managed separately. Use Set price to enter the approved fee before billing.</p>
      <ul>{tests.map(test => <li key={test.name}>
        <label className="check-field"><input type="checkbox" checked={test.available} disabled={busy} onChange={event => void availability(test.name, event.target.checked)} /><span>{test.name}<small>{test.price?.active ? formatMoney(test.price.amount) : 'Billing price not set or disabled'}</small></span></label>
        <button type="button" className="text-button" disabled={busy} onClick={() => edit(test.price || undefined, test.name)}>{test.price ? 'Edit price' : 'Set price'}</button>
      </li>)}</ul>
    </details>
  </>;
}
