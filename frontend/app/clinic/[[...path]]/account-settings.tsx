'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, PageHeading, formatTime } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';
import { cleanClinicPhone, cleanDescriptiveLabel, sanitizeClinicPhoneInput } from '@shared/domain';

export function AccountSettings({ user }: { user: any }) {
  const [currentPassword, setCurrent] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const pwError = password ? (password.length < 12 ? 'Use a password with at least 12 characters.' : password === 'CareRecord2026!' ? 'Choose an individual password instead of the shared setup password.' : '') : '';
  const confirmError = confirmation && password !== confirmation ? 'The two new passwords must match.' : '';
  const pwBlocked = !currentPassword || !password || !!pwError || password !== confirmation;
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (pwBlocked) { setError(pwError || confirmError || 'Complete all password fields cleanly.'); return; }
    setBusy(true);
    try { await clinicRequest('account/password', { currentPassword, password }); window.location.assign('/login?passwordChanged=1'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Password change failed.'); setBusy(false); }
  }
  return <><PageHeading title="Account & password" description={`${user.name} · ${user.username}`} /><div className="account-form">{user.mustChangePassword && <p className="notice-inline">Your account manager issued a temporary password. Replace it before opening clinic records.</p>}<h2>Change your password</h2><p className="form-intro">Use at least 12 characters. After saving, sign in with the new password. Other sessions for this account will end.</p><form onSubmit={submit}><Field label="Current password"><input type="password" autoComplete="current-password" required maxLength={200} value={currentPassword} onChange={e => setCurrent(e.target.value)} /></Field><Field label="New password" error={pwError || undefined}><input type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={password} onChange={e => setPassword(e.target.value)} /></Field><Field label="Confirm new password" error={confirmError || undefined}><input type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></Field>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy || pwBlocked}>{busy ? 'Saving…' : 'Save password and sign out'}</button></form><p className="source-line">Forgotten your password? Contact the clinic account manager for identity verification and a temporary password.</p></div></>;
}
export function OperationsSettings({ initialProfile, initialBackup }: { initialProfile?: { name: string; address: string; contact: string }; initialBackup?: any } = {}) {
  const [profile, setProfile] = useState(initialProfile || { name: '', address: '', contact: '' }); const [backup, setBackup] = useState<any>(initialBackup ?? null);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(!!initialProfile);
  useEffect(() => { if (initialProfile) return; clinicRequest('clinic-settings').then(data => { setProfile(data.profile); setBackup(data.backup); setLoaded(true); }).catch(e => setError(e.message)); }, [initialProfile]);
  const nameError = profile.name.trim() ? (() => { try { cleanDescriptiveLabel(profile.name, 'Clinic name', 120); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid clinic name.'; } })() : '';
  const contactError = profile.contact.trim() ? (() => { try { cleanClinicPhone(profile.contact); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid Philippine mobile or landline number.'; } })() : '';
  const contactInvalid = !!contactError;
  const opsBlocked = !!nameError || contactInvalid;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (opsBlocked) { setError(nameError || contactError); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await clinicRequest('clinic-settings', profile);
      if (saved?.profile) setProfile(saved.profile);
      setMessage('Clinic details saved for printed documents.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  return <><PageHeading title="Clinic operations" description="Manage the clinic details used on saved documents and review recovery arrangements." /><div className="operations-layout"><section className="account-form"><h2>Document details</h2>{loaded && <form onSubmit={submit}><Field label="Clinic name" hint="Displayed as the official header on printed clinical summaries, laboratory reports and receipts." error={nameError || undefined}><input value={profile.name} required maxLength={120} placeholder="e.g. CareRecord Community Clinic - Cordova" onChange={e => setProfile({ ...profile, name: e.target.value })} /></Field><Field label="Clinic address (optional)" hint="Street, barangay, municipality/city, province and ZIP code."><textarea rows={3} value={profile.address} maxLength={300} placeholder="e.g. M.L. Quezon National Highway, Poblacion, Cordova, Cebu 6017" onChange={e => setProfile({ ...profile, address: e.target.value })} /></Field><Field label="Clinic phone number (optional)" hint="Philippine mobile (09XXXXXXXXX or +639XXXXXXXXX) or landline ((032) 496-8200 or (02) 8123-4567)." error={contactInvalid ? contactError : undefined}><input type="tel" inputMode="tel" placeholder="0917 824 5190 or (032) 496-8200" value={profile.contact} maxLength={20} onChange={e => setProfile({ ...profile, contact: sanitizeClinicPhoneInput(e.target.value) })} /></Field><button className="button button-primary" disabled={busy || opsBlocked}>{busy ? 'Saving…' : 'Save document details'}</button></form>}{error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status" className="notice-inline">{message}</p>}</section><section className="operation-guidance"><h2>Backups and recovery</h2><dl className="report-values"><div><dt>Latest encrypted backup</dt><dd>{backup?.createdAt ? formatTime(backup.createdAt) : 'No completed backup recorded'}</dd></div><div><dt>Latest restore test</dt><dd>{backup?.verifiedAt ? formatTime(backup.verifiedAt) : 'No restore test recorded'}</dd></div></dl><details className="form-disclosure"><summary>Backup and downtime guidance</summary><p>The local backup service runs while the clinic service is open. Ask the installation administrator to retain protected copies on a separate device and test recovery regularly.</p><h3>When the system is unavailable</h3><p>Follow the clinic's approved paper procedure, keep patient and visit identification clear, and reconcile the entries after service returns.</p><h3>Before starting clinic operations</h3><p>Have the clinic approve its forms, laboratory panels, access rules and urgent-result procedure. Confirm individual accounts, protected hosting, backup recovery and staff training.</p><p className="source-line">Database recovery and backup keys stay with the installation administrator. They are not downloaded through staff accounts.</p></details></section></div></>;
}
