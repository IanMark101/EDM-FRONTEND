'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationPanel, type NotificationItem } from './notification-panel';
import { clinicRequest } from '@/app/lib/client';
import { formatTime } from './common';

export type SavedNotification = {
  id: string; actor: string; body: string; subject: string; kind: NotificationItem['kind'];
  createdAt: string; readAt: string | null; archivedAt: string | null; href: string;
};
export function StaffNotifications({ notifications, reload }: { notifications: SavedNotification[]; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [error, setError] = useState('');
  const [pending, setPending] = useState<Record<string, Partial<SavedNotification>>>({});
  const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const list = notifications.map(n => ({ ...n, ...pending[n.id] }));
  const unread = list.filter(n => !n.readAt && !n.archivedAt).length;
  const items: NotificationItem[] = list.map(n => ({ id: n.id, actor: { name: n.actor }, kind: n.kind,
    body: [` ${n.body} `, { entity: n.subject }], time: formatTime(n.createdAt),
    unread: !n.readAt, archived: !!n.archivedAt }));
  function close() { setOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { const target = e.target as HTMLElement; if (!root.current?.contains(target) && !target.closest('[data-notification-menu]')) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  async function update(id: string, patch: { unread?: boolean; archived?: boolean }) {
    setError('');
    const next = { ...(patch.unread !== undefined ? { readAt: patch.unread ? null : new Date().toISOString() } : {}),
      ...(patch.archived !== undefined ? { archivedAt: patch.archived ? new Date().toISOString() : null, ...(patch.archived ? { readAt: new Date().toISOString() } : {}) } : {}) };
    setPending(p => ({ ...p, [id]: next }));
    try { await clinicRequest(`notifications/${id}`, patch); await reload(); }
    catch { setError('That change could not be saved. Try again.'); }
    finally { setPending(p => { const next = { ...p }; delete next[id]; return next; }); }
  }
  async function allRead() {
    setError('');
    try { await clinicRequest('notifications/read-all', {}); await reload(); }
    catch { setError('Notifications could not be marked as read. Try again.'); await reload(); }
  }
  return <div className="notification-tray" ref={root}>
    <button ref={trigger} type="button" className="icon-button notification-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-controls="staff-notification-panel" onClick={() => setOpen(o => !o)}>
      <Bell size={19} />{unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="notification-popover" id="staff-notification-panel" role="region" aria-label="Staff notifications">
      {error && <p className="notification-error" role="alert">{error}</p>}
      <NotificationPanel items={items} onClose={close} maxHeight={420} onMarkAllRead={allRead}
        onReadChange={(item, unread) => { void update(item.id, { unread }); }}
        onArchiveChange={(item, archived) => { void update(item.id, { archived }); }}
        onOpenItem={async item => {
          const saved = notifications.find(n => n.id === item.id);
          if (!saved?.href.startsWith('/clinic/')) return;
          try { await clinicRequest(`notifications/${item.id}`, { unread: false }); window.location.assign(saved.href); }
          catch { setError('This task could not be opened. Refresh the work list and try again.'); }
        }} />
    </div>}
  </div>;
}
