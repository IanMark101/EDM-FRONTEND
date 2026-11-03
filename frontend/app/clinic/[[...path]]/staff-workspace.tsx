'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UsersRound, Stethoscope, FlaskConical, ReceiptText, ListChecks, Database, ChartNoAxesCombined, ShieldCheck, History, LogOut, Menu, RefreshCw, ArrowLeft, ChevronRight } from 'lucide-react';
import { Brand, Dialog, Empty, IdentityCard, Panel, formatDate, formatTime } from '@/components/ui/common';
import { StaffNotifications, type SavedNotification } from '@/components/ui/staff-notifications';
import { WorkspaceLoading } from '@/components/ui/workspace-loading';
import { ROLE_NAMES, ROLE_DETAILS, type Role } from '@shared/domain';
import { clinicRequest } from '@/app/lib/client';
import { useNotificationUpdates } from '@/app/lib/notification-updates';
import { WorkflowDialog } from './workflow-dialog';
import { Reception, Consultations, Laboratory, Billing, PatientRegister, ReviewWork, Sources, StaffAccounts, ActivityHistory, PatientWork } from './staff-views';
import { AccountSettings, OperationsSettings } from './account-settings';
import { AnalyticsWorkspace } from './analytics-workspace';

export type WorkspaceData = {
  user: any; patients: any[]; visits: any[]; labs: any[]; invoices: any[]; reviews: any[];
  imports: any[]; facts: any[]; runs: any[]; staff: any[]; history: any[]; generatedAt: string;
  notifications: SavedNotification[]; billingServices: any[]; quality?: any;
};
export type ModalState = { kind: string; row?: any; patient?: any; visit?: any } | null;
export type OpenTask = (task: NonNullable<ModalState>) => void;
const HOME: Record<Role, string> = { registration: 'reception', doctor: 'visits', laboratory: 'laboratory', billing: 'billing', reviewer: 'review', manager: 'staff' };
const NAV = [
  { slug: 'reception', label: 'Patient reception', icon: UsersRound, roles: ['registration'] },
  { slug: 'visits', label: 'Consultations', icon: Stethoscope, roles: ['doctor'] },
  { slug: 'patients', label: 'Assigned patients', icon: UsersRound, roles: ['doctor'] },
  { slug: 'laboratory', label: 'Laboratory work', icon: FlaskConical, roles: ['laboratory', 'doctor'] },
  { slug: 'billing', label: 'Billing & payments', icon: ReceiptText, roles: ['billing'] },
  { slug: 'review', label: 'Identity checks', icon: ListChecks, roles: ['registration', 'reviewer'] },
  { slug: 'reports', label: 'Reports & analytics', icon: ChartNoAxesCombined, roles: ['reviewer'] },
  { slug: 'sources', label: 'Department imports', icon: Database, roles: ['laboratory', 'billing', 'reviewer'] },
  { slug: 'staff', label: 'Staff accounts', icon: UsersRound, roles: ['manager'] },
  { slug: 'operations', label: 'Clinic operations', icon: ShieldCheck, roles: ['manager'] },
  { slug: 'history', label: 'Activity history', icon: History, roles: ['manager', 'reviewer'] },
];

export function ClinicApp({ localNotificationPort }: { localNotificationPort?: string }) {
  const pathname = usePathname(); const router = useRouter(); const slug = pathname.split('/')[2] || '';
  const patientId = slug === 'patients' ? pathname.split('/')[3] : undefined;
  const [data, setData] = useState<WorkspaceData | null>(null); const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); const [modal, setModal] = useState<ModalState>(null);
  const [menuOpen, setMenuOpen] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const loading = useRef(false); const requestSequence = useRef(0); const openedTarget = useRef('');
  const load = useCallback(async (background = true, force = false): Promise<WorkspaceData | null> => {
    if (loading.current && !force) return null; loading.current = true; const sequence = ++requestSequence.current;
    try { const next = await clinicRequest(background ? 'data?refresh=1' : 'data'); if (sequence === requestSequence.current) { setData(next); setError(''); } return next; }
    catch (e) { if (sequence === requestSequence.current) setError(e instanceof Error ? e.message : 'The work list could not be updated.'); return null; }
    finally { if (sequence === requestSequence.current) loading.current = false; }
  }, []);
  const reload = useCallback(async () => { await load(true, true); }, [load]);
  useNotificationUpdates(data?.user.mustChangePassword ? undefined : data?.user.id, localNotificationPort, reload);
  useEffect(() => { void load(false); }, [load]);
  useEffect(() => { if (data && (data.user.mustChangePassword && slug !== 'account' || !slug)) router.replace(data.user.mustChangePassword ? '/clinic/account' : `/clinic/${HOME[data.user.role as Role]}`); }, [data?.user.role, slug, router]);
  useEffect(() => { setMenuOpen(false); setModal(null); }, [pathname]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  useEffect(() => {
    let activeAt = Date.now(), pingAt = Date.now();
    const active = () => { activeAt = Date.now(); };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel']; events.forEach(e => window.addEventListener(e, active, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - activeAt > 20 * 60_000) { window.location.assign('/login?expired=1'); return; }
      if (activeAt > pingAt) { pingAt = Date.now(); clinicRequest('heartbeat', {}).catch(() => {}); }
    }, 60_000);
    return () => { clearInterval(timer); events.forEach(e => window.removeEventListener(e, active)); };
  }, []);
  useEffect(() => { if (patientId) clinicRequest('views', { patientId }).catch(() => {}); }, [patientId]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 9000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search); const id = params.get('open'); const visit = params.get('visit');
    const key = `${pathname}:${id || visit || ''}`;
    if ((!id && !visit) || openedTarget.current === key) return;
    openedTarget.current = key;
    if (slug === 'visits' && data.user.role === 'doctor') {
      const row = data.visits.find(v => v.id === id);
      if (row?.status === 'waiting' && row.doctorId === data.user.id) void clinicRequest(`visits/${row.id}`, { action: 'start', version: row.version })
        .then(() => load(true, true)).then(fresh => { const current = fresh?.visits.find(v => v.id === row.id); if (current) setModal({ kind: 'visit', row: current }); })
        .catch(e => setError(e instanceof Error ? e.message : 'The consultation could not be started.'));
      else if (row) setModal({ kind: 'visit', row });
    }
    if (slug === 'laboratory' && ['doctor', 'laboratory'].includes(data.user.role)) { const row = data.labs.find(l => l.id === id); if (row) setModal({ kind: 'lab', row }); }
    if (slug === 'billing' && data.user.role === 'billing') {
      const row = data.invoices.find(b => b.id === id || b.visitId === visit);
      if (row) setModal({ kind: 'invoice', row });
      else { const v = data.visits.find(v => v.id === visit && v.billingReadyAt); if (v) setModal({ kind: 'invoice-new', visit: v, patient: data.patients.find(p => p.id === v.patientId) }); }
    }
    if (slug === 'review' && ['registration', 'reviewer'].includes(data.user.role)) { const row = data.reviews.find(r => r.id === id); if (row) setModal({ kind: row.kind === 'identity' && row.state === 'open' ? 'review' : 'issue-info', row }); }
  }, [data, pathname, slug]);
  async function saved(message: string, next?: NonNullable<ModalState>) {
    const fresh = await load(true, true);
    if (next?.row?.id && fresh) next = { ...next, row: [...fresh.invoices, ...fresh.visits, ...fresh.labs].find(r => r.id === next!.row.id) || next.row };
    setModal(next || null); setNotice(message);
  }
  async function refresh() { setRefreshing(true); await load(true, true); setRefreshing(false); }
  async function logout() { try { await clinicRequest('logout', {}); window.location.assign('/login'); } catch { setError('Sign-out did not finish. Try again.'); } }
  if (!data) return <WorkspaceLoading error={error} onRetry={() => { setError(''); void load(false); }} />;
  const role = data.user.role as Role;
  const nav = NAV.filter(n => n.roles.includes(role));
  const selected = nav.find(n => n.slug === slug);
  const permitted = (!data.user.mustChangePassword && (!!selected || slug === 'access' || slug === 'patients' && role !== 'manager')) || slug === 'account';
  const open: OpenTask = async task => {
    if (task.kind === 'visit' && task.row?.status === 'waiting' && role === 'doctor' && task.row.doctorId === data.user.id) {
      try { await clinicRequest(`visits/${task.row.id}`, { action: 'start', version: task.row.version }); const fresh = await load(true, true); const row = fresh?.visits.find(v => v.id === task.row.id); if (row) setModal({ ...task, row }); }
      catch (e) { setError(e instanceof Error ? e.message : 'The consultation could not be started.'); }
    } else setModal(task);
  };
  const label = slug === 'account' ? 'Account & password' : slug === 'patients' && patientId ? 'Patient details' : slug === 'access' ? 'My responsibilities' : selected?.label === 'Identity checks' && role === 'reviewer' ? 'Record checks' : selected?.label || 'Your work';
  function navigation() {
    return <><nav aria-label="Staff navigation">{nav.map(n => <Link key={n.slug} href={`/clinic/${n.slug}`} className={`nav-item ${slug === n.slug ? 'active' : ''}`} aria-current={slug === n.slug ? 'page' : undefined}><n.icon size={18} strokeWidth={1.6} /><span>{n.slug === 'review' && role === 'reviewer' ? 'Record checks' : n.slug === 'laboratory' && role === 'doctor' ? 'Tests & reports' : n.label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="staff-scope"><span className="scope-dot" />{ROLE_NAMES[role]} workspace</div><Link href="/clinic/account" className="nav-item"><ShieldCheck size={18} />Account &amp; password</Link><Link href="/clinic/access" className="nav-item"><ShieldCheck size={18} />My responsibilities</Link><button className="nav-item logout" onClick={logout}><LogOut size={18} />Sign out</button></div></>;
  }
  let content: ReactNode;
  if (!permitted) content = <><h1>Access restricted</h1><Empty title="This work belongs to another staff role" action={<Link className="button button-secondary" href={`/clinic/${HOME[role]}`}>Return to my work</Link>} /></>;
  else if (slug === 'account') content = <AccountSettings user={data.user} />;
  else if (slug === 'operations') content = <OperationsSettings />;
  else if (slug === 'reception') content = <Reception data={data} open={open} />;
  else if (slug === 'visits') content = <Consultations data={data} open={open} />;
  else if (slug === 'laboratory') content = <Laboratory data={data} open={open} />;
  else if (slug === 'billing') content = <Billing data={data} open={open} />;
  else if (slug === 'patients' && patientId) {
    const patient = data.patients.find(p => p.id === patientId);
    content = patient ? <><Link className="back-link" href={`/clinic/${HOME[role]}`}><ArrowLeft size={16} />Back to my work</Link><div className="page-heading"><div><h1>{patient.name}</h1><p>Patient {patient.id}</p></div>{['registration', 'reviewer'].includes(role) && <button className="button button-secondary" onClick={() => open({ kind: 'patient-edit', row: patient })}>Correct patient details</button>}</div><IdentityCard patient={patient} doctor={data.staff.find(d => d.id === patient.doctorId)?.name} />{['registration', 'doctor', 'reviewer'].includes(role) && <p className="patient-contact">Contact number: {patient.phone || 'Not provided'}</p>}<PatientWork data={data} patient={patient} open={open} /><details className="form-disclosure"><summary>Record details</summary><p>Source: {patient.source || 'Clinic registration'} · Version {patient.version} · Updated {formatTime(patient.updatedAt)}</p></details></> : <Empty title="This patient is not available to your account" />;
  } else if (slug === 'patients') content = <><PageHeading title={role === 'doctor' ? 'Assigned patients' : 'Patient register'} description={role === 'doctor' ? 'Patient records assigned to your care.' : 'Find the patient identification available for your work.'} /><PatientRegister data={data} open={open} /></>;
  else if (slug === 'review') content = <ReviewWork data={data} open={open} />;
  else if (slug === 'sources') content = <Sources data={data} open={open} />;
  else if (slug === 'staff') content = <StaffAccounts data={data} open={open} />;
  else if (slug === 'history') content = <ActivityHistory data={data} />;
  else if (slug === 'reports') content = <AnalyticsWorkspace data={data} reload={reload} notify={setNotice} />;
  else content = <><PageHeading title="My responsibilities" description={ROLE_DETAILS[role]} /><Panel title={ROLE_NAMES[role]}><p>{ROLE_DETAILS[role]}</p><p>Use your own account. Check patient identity before recording information. Explain corrections so the earlier record and the reason for the change remain available.</p></Panel><Panel title="When another department needs to act"><p>Finish your part of the task and save it. The responsible staff member receives the handoff in their work list and notifications. You can view the information your role needs; changes belonging to another department remain with that department.</p></Panel></>;
  return <div className="clinic-shell staff-app"><aside className="sidebar"><div className="sidebar-brand"><Brand small /><span>Clinic workspace</span></div>{navigation()}</aside><div className="clinic-frame"><header className="app-topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open staff navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><span>{ROLE_NAMES[role]}</span><ChevronRight size={13} /><strong>{label}</strong></div><div className="topbar-tools"><button className="icon-button refresh-control" title="Refresh work lists" aria-label="Refresh work lists" disabled={refreshing} onClick={refresh}><RefreshCw size={17} className={refreshing ? 'spinning' : ''} /></button><StaffNotifications notifications={data.notifications || []} reload={reload} /><div className="staff-identity"><span className="avatar">{data.user.name.replace('Dr. ', '').split(' ').map((s: string) => s[0]).slice(0, 2).join('')}</span><span><strong>{data.user.name}</strong><small>{ROLE_NAMES[role]}</small></span></div></div></header><main className="workspace-sheet"><div className="workspace-content">{error && <div className="form-error refresh-error" role="alert"><p>{error} Your last loaded records remain visible.</p><button className="text-button" onClick={refresh}>Try again</button></div>}{content}<footer className="workspace-footer"><span>CareRecord · {ROLE_NAMES[role]} workspace</span><span>Updated {formatTime(data.generatedAt)}</span></footer></div></main></div>{notice && <div className="toast" role="status">{notice}<button className="text-button" aria-label="Dismiss confirmation" onClick={() => setNotice('')}>Dismiss</button></div>}{menuOpen && <Dialog title="CareRecord navigation" onClose={() => setMenuOpen(false)}><div className="mobile-navigation">{navigation()}</div></Dialog>}{modal && <WorkflowDialog key={`${modal.kind}:${modal.row?.id || modal.patient?.id || 'new'}`} modal={modal} data={data} onClose={() => setModal(null)} onSaved={saved} />}</div>;
}

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
