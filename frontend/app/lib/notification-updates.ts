'use client';
import { useEffect } from 'react';

export function useNotificationUpdates(staffId: string | undefined, localPort: string | undefined, reload: () => Promise<void>) {
  useEffect(() => {
    // Hosted workspaces use the existing authenticated HTTP refresh.
    if (!staffId || !localPort || window.location.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;

    const endpoint = new URL('/api/notifications/live', window.location.origin);
    endpoint.port = localPort;
    endpoint.protocol = 'ws:';

    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    let stopped = false;
    let refreshing = false;
    let pending = false;

    async function catchUp() {
      pending = true;
      if (refreshing) return;
      refreshing = true;
      try {
        while (pending && !stopped) {
          pending = false;
          await reload();
        }
      } finally {
        refreshing = false;
      }
    }

    async function connect() {
      // HTTP polling still refreshes records while live updates reconnect.
      // Check reachability first instead of repeatedly opening failed sockets.
      try {
        const health = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!health.ok) throw new Error('Clinic service is reconnecting');
      } catch {
        if (!stopped) { timer = setTimeout(() => void connect(), delay); delay = Math.min(delay * 2, 30_000); }
        return;
      }
      if (stopped) return;
      const current = new WebSocket(endpoint);
      socket = current;
      current.onopen = () => {
        delay = 1000;
        void catchUp();
      };
      current.onmessage = event => {
        if (event.data === '{"type":"notifications:changed"}') void catchUp();
      };
      current.onclose = event => {
        if (stopped) return;
        if (event.code === 1008) {
          void catchUp();
          return;
        }
        timer = setTimeout(() => void connect(), delay);
        delay = Math.min(delay * 2, 30_000);
      };
    }

    void connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [staffId, localPort, reload]);
}
