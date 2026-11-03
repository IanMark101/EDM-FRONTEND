'use client';
import { useEffect, useId, useRef, Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from 'react';
import Link from 'next/link';
import { Activity, X, Search, ArrowRight, CircleCheck, CircleAlert, Clock3 } from 'lucide-react';

export function Brand({ light = false, small = false }: { light?: boolean; small?: boolean }) {
  return <Link href="/" className={`brand ${light ? 'brand-light' : ''} ${small ? 'brand-small' : ''}`} aria-label="CareRecord home"><Activity strokeWidth={1.5} aria-hidden="true" /><span>CareRecord</span></Link>;
}
export function Status({ value, children }: { value: string; children?: ReactNode }) {
  const good = ['approved', 'signed', 'paid', 'resolved', 'imported', 'active'].includes(value);
  const attention = ['waiting', 'draft', 'open', 'held', 'requested', 'partial'].includes(value);
  const Icon = good ? CircleCheck : attention ? Clock3 : CircleAlert;
  const text: Record<string, string> = { waiting: 'Waiting for doctor', cancelled: 'Cancelled', approved: 'Approved', signed: 'Completed', paid: 'Paid', resolved: 'Resolved', imported: 'Received', active: 'Active', draft: 'In progress', open: 'Needs checking', held: 'Held for review', requested: 'Awaiting result', partial: 'Partly paid', unpaid: 'Unpaid', inactive: 'Disabled', 'kept-separate': 'Kept separate' };
  return <span className={`status ${good ? 'status-good' : attention ? 'status-wait' : 'status-neutral'}`}><Icon size={13} aria-hidden="true" />{children || text[value] || value}</span>;
}
export function Empty({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="empty"><CircleCheck size={22} strokeWidth={1.3} aria-hidden="true" /><h3>{title}</h3>{detail && <p>{detail}</p>}{action}</div>;
}
export function Panel({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><h2>{title}</h2>{aside}</div>{children}</section>;
}
export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function SearchField({ value, onChange, label = 'Search patients' }: { value: string; onChange: (value: string) => void; label?: string }) {
  return <label className="search-field"><Search size={16} aria-hidden="true" /><span className="sr-only">{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={label} type="search" /></label>;
}
export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  const id = useId(); const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const controls = Children.map(children, child => isValidElement(child) && ['input', 'textarea', 'select'].includes(String(child.type))
    ? cloneElement(child as ReactElement<any>, { id, 'aria-describedby': described, 'aria-invalid': error ? true : undefined }) : child);
  return <label className={`field ${error ? 'field-invalid' : ''}`} htmlFor={id}><span>{label}</span>{controls}{hint && <small id={`${id}-hint`}>{hint}</small>}{error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}</label>;
}
export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { const dialog = ref.current; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog?.showModal(); return () => { dialog?.close(); document.body.style.overflow = previous; }; }, []);
  return <dialog ref={ref} className="dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div><div className="dialog-content">{children}</div></dialog>;
}
export function TextLink({ href, children }: { href: string; children: ReactNode }) { return <Link className="text-link" href={href}>{children}<ArrowRight size={15} aria-hidden="true" /></Link>; }
export function IdentityCard({ patient, doctor }: { patient: any; doctor?: string }) {
  return <div className="identity-card"><div className="patient-initial" aria-hidden="true">{patient.name.split(' ').map((s: string) => s[0]).slice(0, 2).join('')}</div><div className="identity-main"><strong>{patient.name}</strong><span>{patient.id}</span></div><dl><div><dt>Birth date</dt><dd>{formatDate(patient.dob)}</dd></div>{doctor && <div><dt>Assigned doctor</dt><dd>{doctor}</dd></div>}</dl></div>;
}
export const formatMoney = (cents: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
export function formatDate(value: string) { if (!value) return '—'; const d = new Date(value.length === 10 ? `${value}T12:00:00+08:00` : value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Taipei' }).format(d); }
export function formatTime(value: string) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' }).format(d); }
