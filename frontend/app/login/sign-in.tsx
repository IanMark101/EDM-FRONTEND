'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Brand } from '@/components/ui/common';

export function Login() {
  const [passwordChanged, setPasswordChanged] = useState(false);
  useEffect(() => { setPasswordChanged(new URLSearchParams(window.location.search).has('passwordChanged')); }, []);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const data: any = await response.json(); if (!response.ok) throw new Error(data.error); window.location.assign('/clinic'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in. Try again.'); setBusy(false); }
  }
  return (
    <main className="login-page">
      <section className="login-story" aria-label="CareRecord clinic workspace">
        <Brand light />
        <div className="login-introduction">
          <h1>A clear record<br />of care</h1>
          <p>The right information, with the people responsible for it.</p>
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
          <h2>Staff sign-in</h2>
          <p>Use the account assigned to you.</p>
          {passwordChanged && <p className="notice-inline" role="status">Password changed. Sign in with your new password.</p>}
          <form onSubmit={submit}>
            <label className="field" htmlFor="staff-username">
              <span>Username</span>
              <input id="staff-username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Your staff username" />
            </label>
            <label className="field" htmlFor="staff-password">
              <span>Password</span>
              <div className="password-field">
                <input id="staff-password" autoComplete="current-password" type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary button-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></button>
          </form>
          <div className="login-assurance"><ShieldCheck size={16} /><span>Your assigned role controls access to clinic records.</span></div>
        </div>
        <p className="login-help">Need an account? Ask the clinic’s account manager.</p>
      </section>
    </main>
  );
}
