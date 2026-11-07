'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Brand } from '@/components/ui/common';
import { clinicRequest } from '@/app/lib/client';

export function Login({ patient = false }: { patient?: boolean }) {
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [expired, setExpired] = useState(false);
  const [activating, setActivating] = useState(false);
  const [code, setCode] = useState('');
  useEffect(() => { const query = new URLSearchParams(window.location.search); setPasswordChanged(query.has('passwordChanged')); setExpired(query.has('expired')); }, []);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (patient) {
        await clinicRequest(`patient-portal/${activating ? 'activate' : 'login'}`, { patientId: username, password, ...(activating ? { code } : {}) });
        window.location.assign('/patient/records');
      } else {
        const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        window.location.assign('/clinic');
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in. Try again.'); setBusy(false); }
  }
  return (
    <main className="login-page">
      <section className="login-story" aria-label={patient ? 'CareRecord patient portal' : 'CareRecord clinic workspace'}>
        <Brand light />
        <div className="login-introduction">
          <h1>{patient ? <>Your care<br />in one place</> : <>A clear record<br />of care</>}</h1>
          <p>{patient ? 'See your completed visits, released test results and bills.' : 'The right information, with the people responsible for it.'}</p>
          <div className="login-coverage" aria-label="Connected clinic work">
            <span>Patient records</span>
            <span>Laboratory reports</span>
            <span>Bills &amp; payments</span>
          </div>
        </div>
        <span className="login-story-footer">Connected records. Clear responsibilities.</span>
      </section>
      <section className="login-form-side">
        <Link href="/" className="back-link"><ArrowLeft size={16} />Back to home</Link>
        <div className="login-form-wrap">
          <h2>{patient ? activating ? 'Set up patient access' : 'Patient sign-in' : 'Staff sign-in'}</h2>
          <p>{patient ? activating ? 'Use the patient number and setup code from Registration.' : 'Use your patient number and password.' : 'Use the account assigned to you.'}</p>
          {expired && <p className="notice-inline" role="status">Your session ended. Please sign in again.</p>}
          {!patient && passwordChanged && <p className="notice-inline" role="status">Password changed. Sign in with your new password.</p>}
          <form onSubmit={submit}>
            <label className="field" htmlFor="staff-username">
              <span>{patient ? 'Patient number' : 'Username'}</span>
              <input id="staff-username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required placeholder={patient ? 'Your patient number' : 'Your staff username'} maxLength={80} />
            </label>
            {patient && activating && <label className="field" htmlFor="patient-code"><span>Setup code</span><input id="patient-code" value={code} onChange={e => setCode(e.target.value)} required maxLength={64} autoComplete="off" spellCheck={false} /></label>}
            <label className="field" htmlFor="staff-password">
              <span>{activating ? 'Choose a password' : 'Password'}</span>
              <div className="password-field">
                <input id="staff-password" autoComplete={activating ? 'new-password' : 'current-password'} type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} minLength={activating ? 12 : undefined} maxLength={200} required />
                <button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary button-full" disabled={busy}>{busy ? 'Please wait…' : activating ? 'Activate account' : 'Sign in'}<ArrowRight size={16} /></button>
          </form>
          <div className="login-assurance"><ShieldCheck size={16} /><span>{patient ? 'Your account shows records for your patient number.' : 'Your assigned role controls access to clinic records.'}</span></div>
          {patient && <button type="button" className="text-button patient-login-switch" disabled={busy} onClick={() => { setActivating(!activating); setError(''); setPassword(''); setCode(''); setVisible(false); }}>{activating ? 'Back to patient sign-in' : 'Have a setup code?'}</button>}
        </div>
        <p className="login-help">{patient ? <>Need access? Ask Registration. <Link href="/login">Staff sign-in</Link></> : <>Need an account? Ask the clinic’s account manager. <Link href="/patient">Patient sign-in</Link></>}</p>
      </section>
    </main>
  );
}
