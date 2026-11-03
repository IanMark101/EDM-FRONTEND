'use client';

import { useId } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { Brand } from './common';

export function WorkspaceLoading({ error, onRetry }: { error?: string; onRetry: () => void }) {
  const titleId = useId();

  return (
    <main className="workspace-start" aria-labelledby={titleId}>
      <div className="workspace-start-panel">
        <Brand />
        <div className="workspace-start-message" role={error ? 'alert' : 'status'} aria-atomic="true">
          {error
            ? <CircleAlert className="workspace-start-error" size={32} strokeWidth={1.5} aria-hidden="true" />
            : <LoaderCircle className="workspace-start-spinner" size={32} strokeWidth={1.5} aria-hidden="true" />}
          <h1 id={titleId}>{error ? 'Your workspace couldn’t load' : 'Opening your workspace'}</h1>
          <p>{error || 'Loading your tasks and records.'}</p>
        </div>
        {error && <button type="button" className="button button-primary workspace-start-retry" onClick={onRetry}>Try again</button>}
      </div>
    </main>
  );
}
