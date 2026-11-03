'use client';
import { useEffect } from 'react';

export function useNotificationUpdates(staffId: string | undefined, localPort: string | undefined, reload: () => Promise<void>) {
  useEffect(() => {
    if (!staffId) return;

    const endpoint = new URL('/api/notifications/live', window.location.origin);
    if (localPort && endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) {
      endpoint.port = localPort;
    }
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';

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

    function connect() {
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
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      };
    }

    connect();
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
