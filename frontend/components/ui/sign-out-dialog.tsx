'use client';
import { useState } from 'react';
import { Dialog } from './common';

export function SignOutDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (busy) return;
    setBusy(true); setError('');
    try { await onConfirm(); }
    catch { setError('Sign-out did not finish. Please try again.'); setBusy(false); }
  }
  return <Dialog title="Sign out of CareRecord?" onClose={onClose} busy={busy} className="sign-out-dialog">
    <p className="form-intro">Save any unfinished work first. You’ll need to sign in again to open your records.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">
      <button autoFocus type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Stay signed in</button>
      <button type="button" className="button button-primary" disabled={busy} onClick={() => void confirm()}>{busy ? 'Signing out…' : 'Sign out'}</button>
    </div>
  </Dialog>;
}
