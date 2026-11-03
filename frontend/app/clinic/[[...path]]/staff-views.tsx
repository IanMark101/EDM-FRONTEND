'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Plus, ArrowRight, FileUp, Search, CircleCheck, Clock3, ShieldCheck } from 'lucide-react';
import { Empty, Panel, SearchField, Status, formatDate, formatTime, formatMoney, PageHeading } from '@/components/ui/common';
import { needsDoctorReview } from '@shared/clinical';
import { ROLE_NAMES, clinicDay, labProblems, type Role } from '@shared/domain';
import type { WorkspaceData, OpenTask } from './staff-workspace';

type Props = { data: WorkspaceData; open: OpenTask };
type Column = { label: string; render: (row: any) => ReactNode; numeric?: boolean; action?: boolean };
const stateOfBill = (b: any) => b.paid >= b.total ? 'paid' : b.paid > 0 ? 'partial' : 'unpaid';
const patientFor = (data: WorkspaceData, id: string) => data.patients.find(p => p.id === id);
function matches(query: string, ...values: any[]) { return values.some(value => String(value || '').toLowerCase().includes(query.toLowerCase().trim())); }
function person(data: WorkspaceData, row: any) {
  const patient = patientFor(data, row.patientId || row.id);
  return <Link className="person-link" href={`/clinic/patients/${patient?.id || row.patientId}`}><span className="avatar">{(patient?.name || '?').split(' ').map((s: string) => s[0]).slice(0, 2).join('')}</span><span><strong>{patient?.name || row.patientId}</strong><small>{row.patientId || row.id}{row.patientId && row.id !== row.patientId ? ` · ${row.id}` : ''}</small></span></Link>;
}
function action(label: string, onClick: () => void) { return <button type="button" className="button button-secondary row-button" onClick={onClick}>{label}<ArrowRight size={14} /></button>; }
export function WorkTabs({ value, onChange, tabs }: { value: string; onChange: (s: string) => void; tabs: { id: string; label: string; count?: number }[] }) {
  return <div className="work-tabs" role="group" aria-label="Work list filters">{tabs.map(t => <button type="button" key={t.id} aria-pressed={value === t.id} onClick={() => onChange(t.id)} className={value === t.id ? 'active' : ''}>{t.label}{t.count !== undefined && <span>{t.count}</span>}</button>)}</div>;
}
function WorkTable({ rows, columns, empty, detail }: { rows: any[]; columns: Column[]; empty: string; detail?: string }) {
  const [limit, setLimit] = useState(25);
  if (!rows.length) return <Empty title={empty} detail={detail} />;
  return <><div className="table-wrap task-table"><table><thead><tr>{columns.map((c, i) => <th key={i} className={c.numeric ? 'num' : c.action ? 'row-action' : ''}>{c.action ? <span className="sr-only">Action</span> : c.label}</th>)}</tr></thead><tbody>{rows.slice(0, limit).map(row => <tr key={row.id}>{columns.map((c, i) => <td key={i} data-label={c.action ? undefined : c.label} className={c.action ? 'row-action' : c.numeric ? 'num' : ''}>{c.render(row)}</td>)}</tr>)}</tbody></table></div>{rows.length > limit && <div className="list-more"><span>{limit} of {rows.length} shown</span><button className="button button-secondary" onClick={() => setLimit(n => n + 25)}>Show more</button></div>}</>;
}
function Toolbar({ search, setSearch, label, count }: { search: string; setSearch: (s: string) => void; label: string; count: number }) {
  return <div className="list-toolbar"><SearchField value={search} onChange={setSearch} label={label} /><span className="muted">{count} {count === 1 ? 'record' : 'records'}</span></div>;
}

export function Reception({ data, open }: Props) {
  const [tab, setTab] = useState('today'); const [query, setQuery] = useState('');
  const todays = data.visits.filter(v => v.date === clinicDay());
  const waiting = todays.filter(v => v.status === 'waiting').length;
  const rows = todays.filter(v => matches(query, patientFor(data, v.patientId)?.name, v.id)).sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || (a.checkedInAt || a.updatedAt).localeCompare(b.checkedInAt || b.updatedAt));
  return <><PageHeading title="Patient reception" description={waiting ? `${waiting} ${waiting === 1 ? 'patient is' : 'patients are'} waiting for consultation.` : 'Find the patient, confirm their details, then check them in for a visit.'} action={<button className="button button-primary" onClick={() => open({ kind: 'patient-new' })}><Plus size={17} />Register patient</button>} />
    <WorkTabs value={tab} onChange={setTab} tabs={[{ id: 'today', label: "Today's visits", count: todays.length }, { id: 'register', label: 'Patient register' }]} />
    {tab === 'today' ? <><Toolbar search={query} setSearch={setQuery} label="Find a patient or visit" count={rows.length} /><WorkTable rows={rows} empty="No visits checked in today" detail="Open the patient register to find an existing patient, or register a new patient when they arrive." columns={[
      { label: 'Patient / visit', render: v => person(data, v) }, { label: 'Doctor', render: v => data.staff.find(d => d.id === v.doctorId)?.name || 'Assigned doctor' },
      { label: 'Checked in', render: v => v.checkedInAt ? formatTime(v.checkedInAt) : formatDate(v.date) }, { label: 'Progress', render: v => <Status value={v.status} /> },
      { label: 'Action', action: true, render: v => v.status === 'waiting' ? action('Cancel check-in', () => open({ kind: 'cancel-checkin', row: v })) : <Link className="text-link" href={`/clinic/patients/${v.patientId}`}>View patient<ArrowRight size={14} /></Link> },
    ]} /><div className="next-step-note"><UsersHint />Check-in sends the visit to the assigned doctor. Registration does not enter consultation notes.</div></> : <PatientRegister data={data} open={open} />}
  </>;
}
function UsersHint() { return <ShieldCheck size={17} />; }

export function PatientRegister({ data, open }: Props) {
  const [search, setSearch] = useState('');
  const rows = data.patients.filter(p => matches(search, p.name, p.id, p.dob));
  const registration = data.user.role === 'registration';
  return <><Toolbar search={search} setSearch={setSearch} label="Search name, patient number or birth date" count={rows.length} /><WorkTable rows={rows} empty="No matching patients" detail={registration ? 'Check the spelling and birth date before creating another patient record.' : 'Try another name or patient number.'} columns={[
    { label: 'Patient', render: p => person(data, p) }, { label: 'Birth date', render: p => formatDate(p.dob) },
    { label: 'Assigned doctor', render: p => data.staff.find(d => d.id === p.doctorId)?.name || 'Not assigned' },
    { label: 'Action', action: true, render: p => registration ? action(data.visits.some(v => v.patientId === p.id && v.status === 'waiting') ? 'View check-in' : 'Check in', () => open({ kind: 'checkin', patient: p })) : <Link className="button button-secondary row-button" href={`/clinic/patients/${p.id}`}>Open patient<ArrowRight size={14} /></Link> },
  ]} /></>;
}

export function Consultations({ data, open }: Props) {
  const [tab, setTab] = useState('active'); const [query, setQuery] = useState('');
  const own = data.visits.filter(v => v.doctorId === data.user.id && v.status !== 'cancelled');
  const toReview = data.labs.filter(needsDoctorReview).sort((a, b) => (a.urgency === 'urgent' ? 0 : 1) - (b.urgency === 'urgent' ? 0 : 1) || a.updatedAt.localeCompare(b.updatedAt));
  const active = own.filter(v => v.status !== 'signed');
  const rows = own.filter(v => (tab === 'active' ? v.status !== 'signed' : v.status === 'signed') && matches(query, patientFor(data, v.patientId)?.name, v.id))
    .sort((a, b) => tab === 'active' ? (a.checkedInAt || a.updatedAt).localeCompare(b.checkedInAt || b.updatedAt) : b.date.localeCompare(a.date));
  return <><PageHeading title="Consultations" description={active.length ? `${active.length} ${active.length === 1 ? 'visit needs' : 'visits need'} your attention. Open a visit to continue care.` : 'Your assigned visits. Patients appear here after check-in.'} />
    {toReview.length > 0 && <div className="report-review-prompt"><span>{toReview.some(l => l.urgency === 'urgent') ? 'Urgent reports need your review.' : `${toReview.length} approved ${toReview.length === 1 ? 'report needs' : 'reports need'} your review.`}</span><Link className="text-link" href="/clinic/laboratory">Review reports<ArrowRight size={15} /></Link></div>}
    <WorkTabs value={tab} onChange={setTab} tabs={[{ id: 'active', label: 'Waiting & in progress', count: active.length }, { id: 'completed', label: 'Completed consultations' }]} /><Toolbar search={query} setSearch={setQuery} label="Find a patient or visit" count={rows.length} />
    <VisitTable data={data} rows={rows} open={open} />
    <div className="next-step-note"><CircleCheck size={17} />Complete the consultation when your notes are ready. Billing then receives the visit; test requests are sent separately.</div>

  </>;
}
function VisitTable({ data, rows, open }: Props & { rows: any[] }) {
  return <WorkTable rows={rows} empty="No visits in this list" detail="Checked-in patients and unfinished consultations will appear in your waiting list." columns={[
    { label: 'Patient / visit', render: v => person(data, v) }, { label: 'Visit date', render: v => formatDate(v.date) },
    { label: 'Progress', render: v => <Status value={v.status} /> },
    { label: 'Action', action: true, render: v => action(v.status === 'signed' || v.doctorId !== data.user.id ? 'View consultation' : v.status === 'waiting' ? 'Start consultation' : 'Continue consultation', () => open({ kind: 'visit', row: v })) },
  ]} />;
}

export function Laboratory({ data, open }: Props) {
  const doctor = data.user.role === 'doctor';
  const [tab, setTab] = useState(doctor ? 'review' : 'waiting'); const [query, setQuery] = useState('');
  const pending = data.labs.filter(l => l.status !== 'approved');
  const needsReview = data.labs.filter(needsDoctorReview);
  const rows = data.labs.filter(l => (tab === 'review' ? needsDoctorReview(l) : tab === 'waiting' ? l.status !== 'approved' : tab === 'approved' ? l.status === 'approved' && (!doctor || !needsDoctorReview(l)) : true) && matches(query, patientFor(data, l.patientId)?.name, l.testName, l.id))
    .sort((a, b) => (a.urgency === 'urgent' && needsDoctorReview(a) ? 0 : 1) - (b.urgency === 'urgent' && needsDoctorReview(b) ? 0 : 1) || (tab === 'waiting' || tab === 'review' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt)));
  const tabs = [...(doctor ? [{ id: 'review', label: 'Needs your review', count: needsReview.length }] : []), { id: 'waiting', label: doctor ? 'Waiting for laboratory' : 'To complete', count: pending.length }, { id: 'approved', label: doctor ? 'Reviewed reports' : 'Approved reports' }, { id: 'all', label: 'All requests' }];
  return <><PageHeading title={doctor ? 'Tests & reports' : 'Laboratory work'} description={doctor ? `${needsReview.length} approved ${needsReview.length === 1 ? 'report needs' : 'reports need'} your review and follow-up decision.` : `${pending.length} ${pending.length === 1 ? 'request needs' : 'requests need'} completion or approval.`} action={doctor ? <button className="button button-primary" onClick={() => open({ kind: 'lab-new' })}><Plus size={17} />Request a test</button> : undefined} />
    <WorkTabs value={tab} onChange={setTab} tabs={tabs} /><Toolbar search={query} setSearch={setQuery} label="Find a patient or test" count={rows.length} /><LabTable data={data} open={open} rows={rows} />
    <div className="next-step-note"><ShieldCheck size={17} />{doctor ? 'Review the approved report and save your follow-up decision. Corrected reports need a new review.' : 'Check the actual panel, sample details and report content before approving. Urgent reports require direct clinician contact.'}</div>
  </>;
}

function LabTable({ data, rows, open }: Props & { rows: any[] }) {
  return <WorkTable rows={rows} empty="No reports in this list" detail={data.user.role === 'laboratory' ? 'New test requests will appear here automatically.' : 'Requests and approved reports for your patients appear here.'} columns={[
    { label: 'Patient / report', render: l => person(data, l) }, { label: 'Test', render: l => <><strong>{l.testName}</strong><small>Visit {l.visitId}</small></> },
    { label: 'Progress', render: l => <><Status value={l.status} />{l.status === 'approved' && <small className={l.urgency === 'urgent' && needsDoctorReview(l) ? 'urgent-label' : ''}>{needsDoctorReview(l) ? l.urgency === 'urgent' ? 'Urgent: awaiting doctor review' : 'Awaiting doctor review' : 'Doctor review recorded'}</small>}</> },
    { label: 'Updated', render: l => formatDate(l.updatedAt) },
    { label: 'Action', action: true, render: l => action(data.user.role === 'doctor' && needsDoctorReview(l) ? 'Review report' : data.user.role !== 'laboratory' || l.status === 'approved' ? 'View report' : l.status === 'requested' ? 'Enter result' : 'Finish report', () => open({ kind: 'lab', row: l })) },
  ]} />;
}

export function Billing({ data, open }: Props) {
  const unbilled = data.visits.filter(v => v.billingReadyAt && !data.invoices.some(b => b.visitId === v.id));
  const outstanding = data.invoices.filter(b => b.paid < b.total);
  const [tab, setTab] = useState(unbilled.length ? 'to-bill' : 'outstanding'); const [query, setQuery] = useState('');
  const visits = unbilled.filter(v => matches(query, patientFor(data, v.patientId)?.name, v.id));
  const bills = data.invoices.filter(b => (tab === 'outstanding' ? b.paid < b.total : tab === 'paid' ? b.paid >= b.total : true) && matches(query, patientFor(data, b.patientId)?.name, b.id)).sort((a, b) => b.date.localeCompare(a.date));
  const prepare = (v: any) => open({ kind: 'invoice-new', visit: v, patient: patientFor(data, v.patientId) });
  return <><PageHeading title="Billing & payments" description={`${unbilled.length} ${unbilled.length === 1 ? 'visit needs' : 'visits need'} a bill. ${outstanding.length} ${outstanding.length === 1 ? 'bill has' : 'bills have'} a remaining balance.`} />
    <WorkTabs value={tab} onChange={setTab} tabs={[{ id: 'to-bill', label: 'To bill', count: unbilled.length }, { id: 'outstanding', label: 'Unpaid & partly paid', count: outstanding.length }, { id: 'paid', label: 'Paid bills' }, { id: 'all', label: 'All bills' }]} />
    <Toolbar search={query} setSearch={setQuery} label="Find a patient, visit or bill" count={tab === 'to-bill' ? visits.length : bills.length} />
    {tab === 'to-bill' ? <WorkTable rows={visits} empty="No visits waiting for a bill" detail="A visit appears here after the doctor completes the consultation. Existing bills remain in the payment lists." columns={[
      { label: 'Patient / visit', render: v => person(data, v) }, { label: 'Visit date', render: v => formatDate(v.date) },
      { label: 'Services provided', render: v => { const services = data.billingServices.find(s => s.visitId === v.id); return <><span>Consultation</span>{services?.tests.length > 0 && <small>{services.tests.map((t: any) => t.name).join(', ')}</small>}</>; } },
      { label: 'Action', action: true, render: v => action('Prepare bill', () => prepare(v)) },
    ]} /> : <BillTable data={data} open={open} rows={bills} />}
    <div className="next-step-note"><ReceiptHint />Record the amount received from the patient. Charges and payments remain separate, so partial payments show the correct balance.</div>
  </>;
}
function ReceiptHint() { return <CircleCheck size={17} />; }
function BillTable({ data, rows, open }: Props & { rows: any[] }) {
  return <WorkTable rows={rows} empty="No bills in this list" detail="Try another list or search by the patient's name." columns={[
    { label: 'Patient / bill', render: b => person(data, b) },
    { label: 'Total charges', numeric: true, render: b => <>{formatMoney(b.total)}<small>{formatMoney(b.paid)} received</small></> },
    { label: 'Remaining balance', numeric: true, render: b => <strong>{formatMoney(b.total - b.paid)}</strong> },
    { label: 'Payment status', render: b => <Status value={stateOfBill(b)} /> },
    { label: 'Action', action: true, render: b => action(b.paid < b.total ? 'Record payment' : 'View bill', () => open({ kind: 'invoice', row: b })) },
  ]} />;
}

export function PatientWork({ data, patient, open }: Props & { patient: any }) {
  const visits = data.visits.filter(v => v.patientId === patient.id).sort((a, b) => b.date.localeCompare(a.date));
  const labs = data.labs.filter(l => l.patientId === patient.id); const bills = data.invoices.filter(b => b.patientId === patient.id);
  const role = data.user.role;
  return <div className="patient-work">
    {role === 'registration' && <><div className="patient-actions"><button className="button button-primary" onClick={() => open({ kind: 'checkin', patient })}>Check in for a visit<ArrowRight size={16} /></button></div><Panel title="Visit progress"><WorkTable rows={visits} empty="No visits recorded" columns={[{ label: 'Visit', render: v => <><strong>{v.id}</strong><small>{formatDate(v.date)}</small></> }, { label: 'Progress', render: v => <Status value={v.status} /> }, { label: 'Action', action: true, render: v => v.status === 'waiting' ? action('Cancel check-in', () => open({ kind: 'cancel-checkin', row: v })) : <span className="muted">With the responsible department</span> }]} /></Panel></>}
    {role === 'doctor' && <Panel title="Consultations" aside={!visits.some(v => v.status === 'waiting' || v.status === 'draft' && v.date === clinicDay()) ? <button className="button button-secondary" onClick={() => open({ kind: 'visit-new', patient })}><Plus size={16} />New consultation</button> : undefined}><VisitTable data={data} rows={visits} open={open} /></Panel>}
    {['doctor', 'laboratory'].includes(role) && <Panel title="Laboratory reports" aside={role === 'doctor' && visits.some(v => !['waiting', 'cancelled'].includes(v.status)) ? <button className="button button-secondary" onClick={() => open({ kind: 'lab-new', patient })}>Request a test</button> : undefined}><LabTable data={data} rows={labs} open={open} /></Panel>}
    {role === 'billing' && <Panel title="Bills & payments"><BillTable data={data} rows={bills} open={open} /></Panel>}
    {role === 'reviewer' && <Panel title="Record questions"><ReviewRows data={data} open={open} rows={data.reviews.filter(r => r.patientId === patient.id)} /></Panel>}
  </div>;
}

export function ReviewWork({ data, open }: Props) {
  const [tab, setTab] = useState('open'); const [query, setQuery] = useState(''); const reviewer = data.user.role === 'reviewer';
  const rows = data.reviews.filter(r => (tab === 'open' ? r.state === 'open' : r.state !== 'open') && matches(query, r.title, r.detail, r.id, patientFor(data, r.patientId)?.name));
  return <><PageHeading title={reviewer ? 'Record checks' : 'Identity checks'} description={reviewer ? 'Check uncertain records and keep each correction with its responsible department.' : 'Confirm patient identity before linking records from another department.'} />
    {reviewer && data.quality && <div className="quality-strip"><div><span>Identity questions</span><strong>{data.quality.identityQuestions}</strong></div><div><span>Incomplete reports</span><strong>{data.quality.incompleteReports}</strong></div><div><span>Imports on hold</span><strong>{data.quality.heldImports}</strong></div></div>}
    <WorkTabs value={tab} onChange={setTab} tabs={[{ id: 'open', label: 'Needs attention', count: data.reviews.filter(r => r.state === 'open').length }, { id: 'resolved', label: 'Resolved checks' }]} />
    <Toolbar search={query} setSearch={setQuery} label="Find a patient or record problem" count={rows.length} /><ReviewRows data={data} open={open} rows={rows} />
    {reviewer && <div className="next-step-note"><ShieldCheck size={17} />Quality checked {formatTime(data.quality?.checkedAt)}. Unfinished reports are work in progress; clinical content is checked by laboratory staff.</div>}
  </>;
}
function ReviewRows({ data, rows, open }: Props & { rows: any[] }) {
  return <WorkTable rows={rows} empty="No record questions in this list" detail="Uncertain patient matches and missing report details appear here when detected." columns={[
    { label: 'Record question', render: r => <><strong>{r.title}</strong><small>{r.recordId}</small></> },
    { label: 'Responsible department', render: r => ROLE_NAMES[r.ownerRole as Role] || r.ownerRole },
    { label: 'Progress', render: r => <Status value={r.state} /> },
    { label: 'Action', action: true, render: r => action(r.state === 'open' && r.kind === 'identity' ? 'Check identity' : 'View details', () => open({ kind: r.state === 'open' && r.kind === 'identity' ? 'review' : 'issue-info', row: r })) },
  ]} />;
}

export function Sources({ data, open }: Props) {
  const [query, setQuery] = useState(''); const canImport = ['laboratory', 'billing'].includes(data.user.role);
  const rows = data.imports.filter(i => matches(query, i.externalId, i.source, i.linkedPatientId));
  return <><PageHeading title="Department imports" description="Receive department files, retain their original record numbers and check uncertain patient matches." action={canImport ? <button className="button button-primary" onClick={() => open({ kind: 'import' })}><FileUp size={17} />Import a file</button> : undefined} />
    <Toolbar search={query} setSearch={setQuery} label="Find an original record number" count={rows.length} /><WorkTable rows={rows} empty="No department files received" detail={canImport ? 'Import a department file to review its records before receiving them.' : 'Received records and their patient-link decisions appear here.'} columns={[
      { label: 'Original record number', render: r => <strong>{r.externalId}</strong> }, { label: 'Department', render: r => r.source === 'laboratory' ? 'Laboratory' : 'Billing' },
      { label: 'Patient link', render: r => r.linkedPatientId || 'Waiting for confirmation' }, { label: 'Received', render: r => formatTime(r.receivedAt) }, { label: 'Progress', render: r => <Status value={r.state} /> },
    ]} /><div className="next-step-note"><ShieldCheck size={17} />Repeated original record numbers are skipped. Uncertain patient matches stay separate until identity is confirmed.</div>
  </>;
}

export function StaffAccounts({ data, open }: Props) {
  const [query, setQuery] = useState(''); const rows = data.staff.filter(s => matches(query, s.name, s.username, ROLE_NAMES[s.role as Role]));
  return <><PageHeading title="Staff accounts" description="Assign each staff member the access needed for their work." action={<button className="button button-primary" onClick={() => open({ kind: 'staff-new' })}><Plus size={17} />Add staff account</button>} /><Toolbar search={query} setSearch={setQuery} label="Find a staff member" count={rows.length} /><WorkTable rows={rows} empty="No matching staff accounts" columns={[
    { label: 'Staff member', render: s => <><strong>{s.name}</strong><small>{s.username}</small></> }, { label: 'Assigned role', render: s => ROLE_NAMES[s.role as Role] },
    { label: 'Account access', render: s => <Status value={s.active ? 'active' : 'inactive'} /> },
    { label: 'Action', action: true, render: s => s.id === data.user.id ? <span className="muted">Your account</span> : action('Manage access', () => open({ kind: 'staff-edit', row: s })) },
  ]} /><div className="next-step-note"><ShieldCheck size={17} />Changing a role or disabling an account ends its active sessions.</div></>;
}
export function ActivityHistory({ data }: { data: WorkspaceData }) {
  const [query, setQuery] = useState(''); const [limit, setLimit] = useState(30);
  const rows = data.history.filter(h => matches(query, h.actor, h.action, h.entityId, h.detail));
  return <><PageHeading title="Activity history" description={data.user.role === 'manager' ? 'Staff account changes and sign-in activity.' : 'Who accessed, changed, approved or exported records, and when.'} /><Toolbar search={query} setSearch={setQuery} label="Find a staff member, action or record" count={rows.length} /><div className="activity-list">{rows.slice(0, limit).map(h => <details className="history-row" key={h.id}><summary><span className="history-dot" /><span><strong>{h.action}</strong><small>{h.actor} · {h.entityId}</small></span><time>{formatTime(h.at)}</time></summary><div className="history-detail"><p>{h.detail}</p><small>{ROLE_NAMES[h.role as Role]}</small></div></details>)}</div>{!rows.length && <Empty title="No matching activity" />}{rows.length > limit && <button className="button button-secondary" onClick={() => setLimit(n => n + 30)}>Show more activity</button>}</>;
}
