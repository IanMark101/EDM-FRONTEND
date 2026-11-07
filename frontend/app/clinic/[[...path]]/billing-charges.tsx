'use client';
import { useState, type FormEvent } from 'react';
import { Dialog, Field, IdentityCard, formatDate, formatMoney, formatTime } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';
import { clinicDay } from '@shared/domain';
import type { ChargeOffer, LinkedCharge } from '@shared/billing';
import type { WorkspaceData, ModalState } from './staff-workspace';

export function ChargeOrigin({ item }: { item: Partial<LinkedCharge> }) {
  if (!item.source || !item.price) return <small className="charge-origin">Earlier charge: service and approved-price references were not recorded.</small>;
  return <details className="charge-origin"><summary>Service {item.source.recordId} · price set by {item.price.setBy}</summary><p>{item.source.name} · {item.source.completedBy}{item.source.completedAt ? ` · ${formatTime(item.source.completedAt)}` : ''}</p><p>Approved price {formatMoney(item.price.amount)} · set {formatTime(item.price.setAt)}</p><p>Added by {item.addedBy}{item.addedAt ? ` · ${formatTime(item.addedAt)}` : ''}</p></details>;
}

export function InvoiceChargeDialog({ modal, data, onClose, onSaved }: { modal: NonNullable<ModalState>; data: WorkspaceData; onClose: () => void; onSaved: (message: string, next?: NonNullable<ModalState>) => Promise<void> }) {
  const adding = modal.kind === 'invoice-add';
  const invoice = adding ? modal.row : undefined;
  const visit = modal.visit || data.visits.find(visit => visit.id === invoice?.visitId);
  const patient = modal.patient || data.patients.find(patient => patient.id === visit?.patientId);
  // Keep the quote visible and stable while the form is open. The server rejects
  // stale prices rather than quietly charging a different amount after refresh.
  const [quote] = useState(() => ({ version: data.priceList?.version, offers: (data.billingServices.find(service => service.visitId === visit?.id)?.charges || []) as ChargeOffer[] }));
  const offers = quote.offers.filter(offer => !offer.alreadyBilled);
  const [selected, setSelected] = useState(() => offers.filter(offer => offer.price).slice(0, 12).map(offer => offer.source.key));
  const [date, setDate] = useState(clinicDay()); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const chosen = offers.filter(offer => selected.includes(offer.source.key) && offer.price);
  const total = chosen.reduce((sum, offer) => sum + offer.price!.amount, 0);
  const consultationIncluded = adding || chosen.some(offer => offer.source.kind === 'consultation');
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || !visit || !patient) return; setBusy(true); setError('');
    try {
      await clinicRequest(adding ? `invoices/${invoice.id}/add-charges` : 'invoices', { patientId: patient.id, visitId: visit.id, date, reason, version: invoice?.version, priceListVersion: quote.version, items: chosen.map(offer => ({ sourceKey: offer.source.key })) });
      await onSaved(adding ? 'Completed services added at the approved prices.' : 'Bill created using the account manager’s approved prices.', adding ? { kind: 'invoice', row: invoice } : undefined);
    } catch (error) { setError(error instanceof Error ? error.message : 'The bill could not be saved.'); setBusy(false); }
  }
  return <Dialog title={adding ? 'Add completed services' : 'Prepare bill'} onClose={() => { if (!busy) onClose(); }}><form onSubmit={save}>
    {patient && <IdentityCard patient={patient} />}{visit && <div className="record-summary"><span>Visit {visit.id}</span><span>{formatDate(visit.date)}</span></div>}
    <p className="form-intro">Choose completed services. Prices come from the account manager’s approved list.</p>
    {adding && invoice.items.some((item: any) => !item.source?.key) && <p className="notice-inline">This bill contains earlier charges without service links. Check its saved charges before adding another service.</p>}
    {!adding && <Field label="Bill date"><input type="date" required max={clinicDay()} value={date} onChange={event => setDate(event.target.value)} /></Field>}
    <div className="billing-service-options">{offers.map(offer => <label className={`billing-service-option ${!offer.price ? 'needs-price' : ''}`} key={offer.source.key}>
      <input type="checkbox" checked={selected.includes(offer.source.key)} disabled={busy || !offer.price || !adding && offer.source.kind === 'consultation'} onChange={event => setSelected(event.target.checked ? [...selected, offer.source.key] : selected.filter(key => key !== offer.source.key))} />
      <span><strong>{offer.source.name}</strong><small>{offer.source.kind === 'consultation' ? 'Completed consultation' : 'Approved laboratory report'} · {offer.source.recordId}</small><small>{offer.source.completedBy}{offer.source.completedAt ? ` · ${formatTime(offer.source.completedAt)}` : ''}</small>{offer.price ? <small>Price set by {offer.price.updatedBy} · {formatTime(offer.price.updatedAt)}</small> : <small className="price-needed">Ask the account manager to set an active price for this service.</small>}</span>
      <strong className="service-approved-price">{offer.price ? formatMoney(offer.price.amount) : 'Price needed'}</strong>
    </label>)}</div>
    {!offers.length && <p className="notice-inline">No unbilled completed services are available. Laboratory services appear after report approval.</p>}
    {quote.offers.some(offer => offer.alreadyBilled) && <p className="source-line">Services already included on this bill are excluded from this selection.</p>}
    {selected.length > 12 && <p className="form-error" role="alert">Add at most 12 services at a time.</p>}
    {!consultationIncluded && <p className="notice-inline">The consultation needs an active price before this bill can be created.</p>}
    {adding && <Field label="Reason for adding these services"><textarea required minLength={12} maxLength={1000} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></Field>}
    <div className="bill-total"><span>{adding ? 'Additional charges' : 'Total charges'}</span><strong>{formatMoney(total)}</strong></div>
    {adding && <p className="source-line">Existing saved charges and payments keep their amounts.</p>}
    {error && <div className="form-error" role="alert"><p>{error}</p><p>Close this window and refresh the work list to review the latest prices and services.</p></div>}
    <div className="form-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || !chosen.length || chosen.length > 12 || !consultationIncluded || quote.version === undefined}>{busy ? 'Saving…' : adding ? 'Add selected services' : 'Create bill'}</button></div>
  </form></Dialog>;
}
