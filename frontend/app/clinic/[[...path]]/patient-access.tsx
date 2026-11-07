'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Dialog, Field, Panel, formatTime } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';

type Access = { status: 'off' | 'pending' | 'expired' | 'active'; expiresAt?: string; code?: string };
const labels = { off: 'No account has been set up.', pending: 'Waiting for the patient to finish setup.', expired: 'The setup code expired.', active: 'The patient account is active.' };

export function PatientAccess({ patientId, notify }: { patientId: string; notify: (message: string) => void }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [action, setAction] = useState<'issue' | 'disable' | null>(null);
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const path = `patient-access/${encodeURIComponent(patientId)}`;
  useEffect(() => {
    let current = true;
    clinicRequest(path).then((next: Access) => { if (current) { setAccess(next); setError(''); } })
      .catch(error => { if (current) setError(error.message); });
    return () => { current = false; };
  }, [path, retry]);
  const show = (next: 'issue' | 'disable') => { setAction(next); setVerified(false); setReason(''); setError(''); };
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || !verified) return;
    setBusy(true); setError('');
    try {
      const next: Access = await clinicRequest(path, { action, verified, reason });
      setAccess(next); setAction(null);
      if (!next.code) notify('Patient portal access disabled.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to update patient access.'); }
    finally { setBusy(false); }
  }
  return <Panel title="Patient portal access">
    <p>{access ? labels[access.status] : error ? 'Patient access status is unavailable.' : 'Checking account status…'}</p>
    <p>Confirm the patient’s identity in person before giving them a setup code.</p>
    {!action && error && <div className="form-error" role="alert">{error}<button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {access && <div className="patient-actions"><button type="button" className="button button-secondary" onClick={() => show('issue')}><ShieldCheck size={16} />{access.status === 'off' ? 'Create setup code' : 'Replace access'}</button>{access.status !== 'off' && <button type="button" className="text-button" onClick={() => show('disable')}>Disable access</button>}</div>}
    {action && <Dialog title={action === 'disable' ? 'Disable patient access' : access?.status === 'off' ? 'Create patient setup code' : 'Replace patient access'} onClose={() => { if (!busy) { setAction(null); setError(''); } }}>
      <form onSubmit={save}>
        <p className="form-intro">{action === 'disable' ? 'The patient will be signed out and will need a new setup code to return.' : 'Give the patient their number and the one-time code privately. The code expires after 24 hours.'}</p>
        {action === 'issue' && access?.status !== 'off' && <p className="notice-inline">This replaces the current password or setup code and signs out the patient.</p>}
        <label className="check-field"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} /><span>I confirmed this patient’s identity in person.</span></label>
        {(action === 'disable' || access?.status !== 'off') && <Field label="Reason"><textarea required minLength={12} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></Field>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button button-primary" disabled={busy || !verified}>{busy ? 'Saving…' : action === 'disable' ? 'Disable access' : 'Generate setup code'}</button></div>
      </form>
    </Dialog>}
    {access?.code && !action && <Dialog title="Patient setup code" onClose={() => setAccess({ status: 'pending', expiresAt: access.expiresAt })}>
      <p className="form-intro">Give these details directly to the verified patient. The code is displayed once.</p>
      <Field label="Patient number"><input readOnly value={patientId} /></Field>
      <Field label="One-time setup code"><input readOnly value={access.code} /></Field>
      <p className="source-line">Expires {formatTime(access.expiresAt || '')} (clinic time). On the Patient sign-in page, select <strong>Have a setup code?</strong></p>
      <div className="form-actions"><button type="button" className="button button-primary" onClick={() => setAccess({ status: 'pending', expiresAt: access.expiresAt })}>Done</button></div>
    </Dialog>}
  </Panel>;
}
