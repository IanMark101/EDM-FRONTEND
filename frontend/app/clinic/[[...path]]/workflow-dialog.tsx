'use client';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Check, ClipboardCheck, ArrowRight } from 'lucide-react';
import { Dialog, Field, Status, IdentityCard, formatMoney, formatTime, formatDate } from '@/components/ui/common';
import { NAME_SUFFIXES, ROLE_NAMES, ROLES, STAFF_TITLES, cleanDescriptiveLabel, cleanPersonName, cleanPhone, clinicDay, composePersonName, labProblems, sanitizeDecimalInput, sanitizeNamePartInput, sanitizePhoneInput, sanitizeUsernameInput, splitPersonName, validatePayment, type Role } from '@shared/domain';
import type { ModalState, WorkspaceData } from './workspace';
import { clinicRequest } from '@/app/lib/client';
import { ClinicalFields, ClinicalReadout, MeasurementEditor, ReportReadout, PrintLink, emptyClinical } from './clinical-fields';
import { ChargeOrigin, InvoiceChargeDialog } from './billing-charges';
import { SPECIMEN_OPTIONS, URGENT_CONTACT_METHODS, cleanLabUnit, labResultError, measurementProblems, needsDoctorReview, suggestedLayout, templateRows, vitalErrors } from '@shared/clinical';
import { TestPicker } from '@/components/ui/test-picker';
import { SpecimenPicker, UnitPicker } from '@/components/ui/unit-picker';

function localTime(iso: string) { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(' ', 'T'); }
function isoTime(local: string) { return local ? new Date(`${local}:00+08:00`).toISOString() : ''; }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

type WorkflowProps = { modal: NonNullable<ModalState>; data: WorkspaceData; onClose: () => void; onSaved: (message: string, next?: NonNullable<ModalState>) => Promise<void> };
export function WorkflowDialog(props: WorkflowProps) {
  return ['invoice-new', 'invoice-add'].includes(props.modal.kind) ? <InvoiceChargeDialog {...props} /> : <RecordWorkflowDialog {...props} />;
}
function RecordWorkflowDialog({ modal, data, onClose, onSaved }: WorkflowProps) {
  const { kind, row = {} } = modal; const role: Role = data.user.role;
  const initialPatient = modal.patient || data.patients.find(p => p.id === row.patientId || p.id === modal.visit?.patientId);
  const initialNameParts = splitPersonName(row.name, kind === 'staff-new' || kind === 'staff-edit');
  const [form, setForm] = useState<any>({
    patientId: initialPatient?.id || '', visitId: modal.visit?.id || row.visitId || [...data.visits].filter(v => v.patientId === initialPatient?.id).sort((a, b) => b.date.localeCompare(a.date))[0]?.id || '',
    name: row.name || '', title: initialNameParts.title, firstName: initialNameParts.firstName, middleName: initialNameParts.middleName, lastName: initialNameParts.lastName, suffix: initialNameParts.suffix,
    dob: row.dob || '', phone: row.phone || '', doctorId: row.doctorId || initialPatient?.doctorId || '',
    date: row.date || today(), reason: '', visitReason: row.reason || '', notes: row.notes || '', testName: '', value: row.value || '', unit: row.unit || '', collectedAt: localTime(row.collectedAt),
    specimen: row.specimen || '', reportComment: row.reportComment || '', urgency: row.urgency || 'routine', contactPerson: row.contact?.person || '', contactMethod: row.contact?.method || '', contactAt: localTime(row.contact?.at), reviewPlan: '', followUpDate: row.doctorReview?.followUpDate || '', followUpTime: row.doctorReview?.followUpTime || '', reviewConfirmed: false,
    reviewed: false, amount: '', method: 'Cash', reference: '', decision: 'keep-separate', confirmedDob: '', evidence: '',
    username: row.username || '', password: '', role: row.role || 'registration', active: row.active ?? true, cancelReason: '',
  });
  const [clinical, setClinical] = useState<any>(() => ({ ...emptyClinical(), ...(row.clinical || {}) }));
  const [structured, setStructured] = useState(row.status !== 'signed' || !!row.clinical?.structured);
  const initialLayout = row.status === 'requested' && !row.value && !row.measurements?.length ? suggestedLayout(row.testName || '') : row.layout || 'general';
  const [layout, setLayout] = useState(initialLayout);
  const [measurements, setMeasurements] = useState<any[]>(row.measurements?.length ? row.measurements : initialLayout !== 'general' ? templateRows(initialLayout) : []);
  const [error, setError] = useState(''); const [busyAction, setBusyAction] = useState<string | null>(null); const pendingAction = useRef<string | null>(null); const busy = busyAction !== null; const [editing, setEditing] = useState(false); const [checkResult, setCheckResult] = useState<string[] | null>(null);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [voidReasons, setVoidReasons] = useState<Record<string, string>>({});
  const draft = JSON.stringify([form, clinical, structured, layout, measurements]);
  const [initialDraft] = useState(draft);
  const [nextTask, setNextTask] = useState<NonNullable<ModalState> | null>(null);
  const hasUnsavedChanges = draft !== initialDraft;
  function switchTask(task: NonNullable<ModalState>) {
    if (busy) return;
    if (hasUnsavedChanges) setNextTask(task);
    else void onSaved('', task);
  }
  const set = (key: string, value: any) => { setForm((f: any) => ({ ...f, [key]: value })); setError(''); if (['value', 'unit', 'specimen', 'collectedAt', 'urgency', 'contactPerson', 'contactMethod', 'contactAt'].includes(key)) setCheckResult(null); };
  const chosenPatient = data.patients.find(p => p.id === form.patientId);
  const availableVisits = [...data.visits].filter(v => v.patientId === form.patientId && v.status !== 'cancelled' && (kind === 'invoice-new' ? !!v.billingReadyAt && !data.invoices.some(b => b.visitId === v.id) : kind === 'lab-new' ? v.doctorId === data.user.id && v.status !== 'waiting' : true)).sort((a, b) => b.date.localeCompare(a.date));
  function choosePatient(id: string) { const visit = [...data.visits].filter(v => v.patientId === id && v.status !== 'cancelled' && (kind === 'invoice-new' ? !!v.billingReadyAt && !data.invoices.some(b => b.visitId === v.id) : kind === 'lab-new' ? v.doctorId === data.user.id && v.status !== 'waiting' : true)).sort((a, b) => b.date.localeCompare(a.date))[0]; setForm((f: any) => ({ ...f, patientId: id, visitId: visit?.id || '' })); }
  function patientSelect(withVisit = false) { if ((modal.patient && (!withVisit || modal.visit)) || kind === 'invoice-add') return <><IdentityCard patient={modal.patient || initialPatient} />{modal.visit && <div className="record-summary"><span>Visit {modal.visit.id}</span><span>{formatDate(modal.visit.date)}</span></div>}</>; return <><Field label="Patient"><select required value={form.patientId} onChange={e => choosePatient(e.target.value)}><option value="">Choose patient</option>{data.patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}</select></Field>{chosenPatient && <div className="identity-confirm"><strong>{chosenPatient.id}</strong><span>{chosenPatient.name} · Born {formatDate(chosenPatient.dob)}</span></div>}{withVisit && <Field label="Visit"><select required value={form.visitId} onChange={e => set('visitId', e.target.value)}><option value="">Choose visit</option>{availableVisits.map(v => <option key={v.id} value={v.id}>{v.id} · {formatDate(v.date)}</option>)}</select></Field>}{withVisit && !availableVisits.length && <p className="notice-inline">No eligible visit is available. Complete the consultation before billing, or start it before requesting a test.</p>}</>; }
  function footer(label: string, action = 'save', extra?: ReactNode, blocked = false, busyLabel = 'Saving…') { return <div className="form-actions">{extra}<button type="submit" name="action" value={action} onClick={() => { pendingAction.current = action; }} className="button button-primary" disabled={busy || blocked} aria-describedby={blocked && kind === 'lab' ? "lab-approval-help" : undefined}>{busyAction === action ? busyLabel : label}</button></div>; }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)?.value || pendingAction.current || 'save';
    pendingAction.current = null;
    setBusyAction(action); setError('');
    try {
      let path = '', body: any = {}, message = 'Record saved.';
      if (kind === 'patient-new' || kind === 'patient-edit') {
        const composedName = composePersonName({ firstName: form.firstName, middleName: form.middleName, lastName: form.lastName, suffix: form.suffix });
        path = kind === 'patient-new' ? 'patients' : `patients/${row.id}`;
        body = { ...form, name: composedName, version: row.version };
        message = kind === 'patient-new' ? 'Patient registered. A permanent patient number has been assigned.' : 'Patient details corrected. The earlier information remains in history.';
      }
      else if (kind === 'checkin') { path = 'check-ins'; body = { patientId: form.patientId, date: form.date }; message = 'Patient checked in. The visit is on the assigned doctor’s waiting list.'; }
      else if (kind === 'cancel-checkin') { path = `check-ins/${row.id}`; body = { reason: form.reason, version: row.version }; message = 'Check-in cancelled. The patient record remains available.'; }
      else if (kind === 'visit-new') { path = 'visits'; body = form; message = 'Consultation opened with its own visit number.'; }
      else if (kind === 'visit' && action === 'start') { path = `visits/${row.id}`; body = { action: 'start', version: row.version }; message = 'Consultation started.'; }
      else if (kind === 'visit' && action === 'cancel') { path = `visits/${row.id}`; body = { action: 'cancel', reason: form.cancelReason, version: row.version }; message = 'Open consultation cancelled. The patient can be checked in again when needed.'; }
      else if (kind === 'visit') { path = `visits/${row.id}`; body = { notes: form.notes, ...(structured ? { clinical } : {}), visitReason: form.visitReason, reason: form.reason, version: row.version, action: action === 'request-test' ? 'save' : action }; message = action === 'sign' ? 'Consultation completed. Billing can now prepare the bill.' : action === 'correct' ? 'Signed consultation corrected. The previous version was retained.' : 'Consultation draft saved.'; }
      else if (kind === 'lab-new') { path = 'labs'; body = { patientId: form.patientId, visitId: form.visitId, testName: form.testName }; message = 'Laboratory request sent to laboratory staff.'; }
      else if (kind === 'lab' && action === 'patient-release') {
        path = `labs/${row.id}/patient-release`;
        body = { version: row.version, confirmed: form.releaseConfirmed };
        message = 'Laboratory result released to the patient portal.';
      }
      else if (kind === 'lab' && action === 'return-appointment') {
        path = `labs/${row.id}/return-appointment`;
        body = { version: row.version, followUpDate: form.followUpDate, followUpTime: form.followUpTime };
        message = 'Return appointment saved.';
      }
      else if (kind === 'lab' && action === 'cancel') { path = `labs/${row.id}`; body = { action: 'cancel', reason: form.cancelReason, version: row.version }; message = 'Laboratory request cancelled.'; }
      else if (kind === 'lab') { path = `labs/${row.id}${action === 'doctor-review' ? '/doctor-review' : ''}`; body = action === 'doctor-review' ? { version: row.version, plan: form.reviewPlan, followUpDate: form.followUpDate, followUpTime: form.followUpTime, confirmed: form.reviewConfirmed } : { ...form, layout, measurements, contact: form.urgency === 'urgent' ? { person: form.contactPerson, method: form.contactMethod, at: isoTime(form.contactAt) } : {}, collectedAt: isoTime(form.collectedAt), version: row.version, action }; message = action === 'doctor-review' ? 'Doctor review and follow-up decision saved.' : action === 'save' ? 'Laboratory draft saved.' : 'Report approved. The assigned doctor has been notified.'; }
      else if (kind === 'invoice') { path = `invoices/${row.id}/payment`; body = { amount: form.amount, method: form.method, reference: form.reference, version: row.version }; message = 'Payment recorded. The amount due has been updated.'; }
      else if (kind === 'review') { path = `reviews/${row.id}`; body = form; message = form.decision === 'link' ? 'Identity confirmed and source record linked. The decision is recorded.' : 'Source record kept separate. Your evidence is recorded.'; }
      else if (kind === 'staff-reset') { path = `staff/${row.id}/reset-password`; body = { password: form.password, reason: form.reason }; message = 'Temporary password set. Existing sessions ended; the staff member must replace it at sign-in.'; }
      else if (kind === 'staff-new' || kind === 'staff-edit') {
        const composedStaffName = kind === 'staff-new' ? composePersonName({ title: form.title, firstName: form.firstName, lastName: form.lastName }) : form.name;
        path = kind === 'staff-new' ? 'staff' : `staff/${row.id}`;
        body = { ...form, name: composedStaffName };
        message = kind === 'staff-new' ? 'Staff account created with an assigned role.' : 'Staff access updated. Existing sessions for that account have ended.';
      }
      const result = await clinicRequest(path, body);
      if (kind === 'checkin' && result.alreadyWaiting) message = `This patient already has an open visit: ${result.id}.`;
      let next: NonNullable<ModalState> | undefined;
      if (kind === 'patient-new') next = { kind: 'checkin', patient: { ...form, name: composePersonName({ firstName: form.firstName, middleName: form.middleName, lastName: form.lastName, suffix: form.suffix }), id: result.id } };
      if (kind === 'invoice-add') next = { kind: 'invoice', row };
      if (kind === 'visit' && action === 'start') next = { kind: 'visit', row };
      if (kind === 'visit' && action === 'request-test') next = { kind: 'lab-new', patient: initialPatient, visit: row };
      if (kind === 'lab' && ['doctor-review', 'patient-release', 'return-appointment'].includes(action)) next = { kind: 'lab', row };
      await onSaved(message, next);
      setBusyAction(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'The record could not be saved.'); setBusyAction(null); }
  }
  async function voidPayment(paymentId: string) {
    if (busy) return;
    setBusyAction(`void:${paymentId}`); setError('');
    try {
      await clinicRequest(`invoices/${row.id}/void-payment`, { paymentId, reason: voidReasons[paymentId] || '', version: row.version });
      await onSaved('Payment voided. The remaining balance has been updated.', { kind: 'invoice', row });
      setBusyAction(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'The payment could not be voided.'); setBusyAction(null); }
  }
  let title = '', fields: ReactNode;
  if (kind === 'checkin') {
    title = 'Check in for a visit';
    const active = data.visits.find(v => v.patientId === form.patientId && (v.status === 'waiting' || v.status === 'draft'));
    fields = <>{initialPatient && <IdentityCard patient={initialPatient} doctor={data.staff.find(d => d.id === initialPatient.doctorId)?.name} />}<p className="form-intro">{active ? `This patient already has an active visit: ${active.id}. Another check-in is not needed.` : 'Confirm the patient has arrived. This visit will be sent to the assigned doctor.'}</p><div className="simple-row"><span>Visit date</span><strong>{formatDate(form.date)}</strong></div>{active ? <div className="form-actions">{active.status === 'waiting' && <button type="button" className="button button-secondary" onClick={() => switchTask({ kind: 'cancel-checkin', row: active })}>Cancel check-in</button>}<button type="button" className="button button-secondary" onClick={onClose}>Close</button></div> : footer('Check in patient')}</>;
  } else if (kind === 'cancel-checkin') {
    title = 'Cancel check-in';
    fields = <>{initialPatient && <IdentityCard patient={initialPatient} />}<p className="form-intro">Remove this waiting visit from the doctor’s list. The patient’s records remain available.</p><Field label="Reason for cancelling"><textarea required rows={3} minLength={12} maxLength={1000} value={form.reason} onChange={e => set('reason', e.target.value)} /></Field>{footer('Cancel check-in')}</>;
  } else if (kind === 'issue-info') {
    title = 'Record check details';
    fields = <><div className="record-summary"><strong>{row.title}</strong><Status value={row.state} /></div><p className="form-intro">{row.detail}</p><p>Responsible department: <strong>{ROLE_NAMES[row.ownerRole as Role]}</strong></p>{row.resolution && <p className="notice-inline">{row.resolution}</p>}{row.evidence && <p>Decision evidence: {row.evidence}</p>}<p className="source-line">Record {row.recordId}. Clinical report changes are made by the responsible laboratory staff.</p><div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>Close</button></div></>;
  } else if (kind === 'patient-new' || kind === 'patient-edit') {
    title = kind === 'patient-new' ? 'Register patient' : 'Correct patient details';
    const composedName = composePersonName({ firstName: form.firstName, middleName: form.middleName, lastName: form.lastName, suffix: form.suffix });
    const validNamePart = (val: string, label: string) => {
      const t = String(val || '').trim();
      if (!t) return '';
      if (!/\p{L}/u.test(t) || !/^[\p{L}\p{M} .'’-]+$/u.test(t)) return `Enter a valid ${label.toLowerCase()} using letters, spaces, periods, hyphens or apostrophes.`;
      return '';
    };
    const firstNameError = validNamePart(form.firstName, 'First name');
    const middleNameError = validNamePart(form.middleName, 'Middle name');
    const lastNameError = validNamePart(form.lastName, 'Last name');
    const nameMissingParts = !form.firstName.trim() || !form.lastName.trim();
    const composedNameError = !nameMissingParts && !firstNameError && !middleNameError && !lastNameError ? (() => { try { cleanPersonName(composedName, 'Patient name', 120); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid patient name.'; } })() : '';
    const dobError = form.dob && (form.dob < '1900-01-01' || form.dob > today()) ? 'Enter a valid birth date between 1900-01-01 and today.' : '';
    const phoneInvalid = !!form.phone.trim() && (() => { try { cleanPhone(form.phone); return false; } catch { return true; } })();
    const reasonNeeded = kind === 'patient-edit' || !!form.confirmDifferentPerson;
    const reasonShort = reasonNeeded && form.reason.trim().length > 0 && form.reason.trim().length < 12;
    const patientBlocked = nameMissingParts || !!firstNameError || !!middleNameError || !!lastNameError || !!composedNameError || !form.dob || !!dobError || !form.doctorId || phoneInvalid || (reasonNeeded && form.reason.trim().length < 12);
    fields = <><p className="form-intro">Confirm the name and birth date before saving. Patient numbers are assigned automatically.</p><div className="form-grid"><Field label="First name" error={firstNameError || undefined}><input required maxLength={50} placeholder="e.g. Maria" value={form.firstName} onChange={e => set('firstName', sanitizeNamePartInput(e.target.value, 50))} autoComplete="off" /></Field><Field label="Middle name (optional)" error={middleNameError || undefined}><input maxLength={50} placeholder="e.g. Clara" value={form.middleName} onChange={e => set('middleName', sanitizeNamePartInput(e.target.value, 50))} autoComplete="off" /></Field></div><div className="form-grid"><Field label="Last name" error={lastNameError || undefined}><input required maxLength={50} placeholder="e.g. Santos or De la Cruz" value={form.lastName} onChange={e => set('lastName', sanitizeNamePartInput(e.target.value, 50))} autoComplete="off" /></Field><Field label="Suffix (optional)"><select value={form.suffix} onChange={e => set('suffix', e.target.value)}>{NAME_SUFFIXES.map(s => <option key={s || 'none'} value={s}>{s || 'None'}</option>)}</select></Field></div>{!nameMissingParts && <p className="source-line">Standardized record name: <strong>{composedName}</strong></p>}{composedNameError && <p className="form-error" role="alert">{composedNameError}</p>}<div className="form-grid"><Field label="Birth date" error={dobError || undefined}><input type="date" required min="1900-01-01" max={today()} value={form.dob} onChange={e => set('dob', e.target.value)} /></Field><Field label="Contact number (optional)" hint="11-digit mobile (09XXXXXXXXX or +639XXXXXXXXX)." error={phoneInvalid ? 'Enter an 11-digit Philippine mobile number starting with 09 (or +639).' : undefined}><input type="tel" inputMode="tel" placeholder="0917 123 4567" value={form.phone} maxLength={16} onChange={e => set('phone', sanitizePhoneInput(e.target.value))} /></Field></div><Field label="Assigned doctor"><select value={form.doctorId} onChange={e => set('doctorId', e.target.value)} required><option value="">Choose doctor</option>{data.staff.filter(u => u.role === 'doctor').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>{kind === 'patient-edit' ? <Field label="Reason for correction" error={reasonShort ? 'Explain the correction in at least 12 characters.' : undefined}><textarea required minLength={12} maxLength={1000} rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} /></Field> : <details className="form-disclosure"><summary>Another patient has the same name and birth date</summary><label className="check-field"><input type="checkbox" checked={!!form.confirmDifferentPerson} onChange={e => set('confirmDifferentPerson', e.target.checked)} /><span>I verified that this is a different person.</span></label><Field label="Evidence checked" error={reasonShort ? 'Explain the evidence in at least 12 characters.' : undefined}><textarea value={form.reason} onChange={e => set('reason', e.target.value)} minLength={form.confirmDifferentPerson ? 12 : undefined} required={!!form.confirmDifferentPerson} rows={3} /></Field></details>}{footer(kind === 'patient-new' ? 'Register patient' : 'Save correction', 'save', undefined, patientBlocked)}</>;
  } else if (kind === 'visit-new') {
    title = 'New consultation'; fields = <>{patientSelect()}<Field label="Visit date"><input type="date" value={form.date} min={chosenPatient?.dob || '1900-01-01'} max={today()} onChange={e => set('date', e.target.value)} required /></Field><Field label="Reason for visit"><input value={form.reason} onChange={e => set('reason', e.target.value)} required maxLength={200} /></Field><Field label="Consultation notes (optional)"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={5} maxLength={5000} /></Field>{footer('Open consultation')}</>;
  } else if (kind === 'visit' && row.status === 'cancelled') {
    title = 'Cancelled consultation'; fields = <>{initialPatient && <IdentityCard patient={initialPatient} />}<p className="notice-inline">This visit was cancelled. It is no longer on your work list.</p><div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>Close</button></div></>;
  } else if (kind === 'visit' && row.status === 'waiting') {
    title = 'Waiting check-in';
    const isResponsibleDoctor = row.doctorId === data.user.id;
    fields = <>{initialPatient && <IdentityCard patient={initialPatient} />}<div className="record-summary"><span>{row.id} · {formatDate(row.date)}</span><Status value={row.status} /></div><p className="form-intro">This patient is checked in and waiting. Start the consultation when you are ready to see them.</p><div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>Close</button>{isResponsibleDoctor && <button type="submit" name="action" value="start" onClick={() => { pendingAction.current = 'start'; }} className="button button-primary" disabled={busy}>{busyAction === 'start' ? 'Starting…' : 'Start consultation'}</button>}</div></>;
  } else if (kind === 'visit') {
    title = 'Consultation';
    const p = data.patients.find(p => p.id === row.patientId);
    const isResponsibleDoctor = row.doctorId === data.user.id;
    const readonly = row.status === 'signed' && !editing || !isResponsibleDoctor;
    const tests = data.labs.filter(report => report.visitId === row.id && report.patientId === row.patientId);
    const vitalsErrs = structured ? vitalErrors(clinical.vitals) : {};
    const vitalsInvalid = Object.keys(vitalsErrs).length > 0;
    const allergyMissing = structured && clinical.allergyStatus === 'recorded' && !String(clinical.allergies || '').trim();
    const correctionShort = editing && form.reason.trim().length > 0 && form.reason.trim().length < 12;
    const visitBlocked = vitalsInvalid || allergyMissing || (editing && form.reason.trim().length < 12);
    const draftActions = <>
      <button type="submit" name="action" value="save" formNoValidate onClick={() => { pendingAction.current = 'save'; }} className="button button-secondary" disabled={busy || vitalsInvalid || allergyMissing}>{busyAction === 'save' ? 'Saving draft…' : 'Save draft'}</button>
      <button type="submit" name="action" value="request-test" formNoValidate onClick={() => { pendingAction.current = 'request-test'; }} className="button button-secondary" disabled={busy || vitalsInvalid || allergyMissing}>{busyAction === 'request-test' ? 'Opening test request…' : tests.length ? 'Request another test' : 'Request test'}</button>
    </>;
    fields = <>
      {p && <IdentityCard patient={p} />}
      <div className="record-summary"><span>{row.id} · {formatDate(row.date)}</span><Status value={row.status} /></div>
      {readonly ? <>
        <h3>Reason for visit</h3>
        <p>{row.reason}</p>
        {row.notes && <><h3>Consultation notes</h3><p className="clinical-notes">{row.notes}</p></>}
        <ClinicalReadout value={row.clinical} />
        <p className="source-line">Completed {formatTime(row.signedAt)}. Earlier signed details remain in history.</p>
        {isResponsibleDoctor && <div className="patient-actions">
          <PrintLink kind="visit" id={row.id} />
          <button className="button button-secondary" type="button" onClick={() => onSaved('', { kind: 'lab-new', patient: p, visit: row })}>Request a test for this visit</button>
          <button className="text-button" type="button" onClick={() => setEditing(true)}>Record a correction</button>
        </div>}
      </> : <>
        {!editing && <>
          <p className="form-intro">When you finish seeing the patient, complete the consultation to send the visit to Billing.</p>
          {!!tests.length && <section className="visit-tests" aria-label="Tests for this visit">
            <h3>Tests for this visit</h3>
            <ul>{tests.map(report => {
              const needsReview = needsDoctorReview(report);
              const progress = report.status === 'cancelled' ? 'Cancelled' : report.status !== 'approved' ? 'Waiting for the lab'
                : needsReview ? 'Lab approved · Doctor review needed'
                : report.doctorReview?.releasedAt ? 'Shared in patient portal' : 'Reviewed · Ready to share';
              return <li key={report.id}>
                <div><strong>{report.testName}</strong><span>{progress}</span></div>
                {report.status === 'approved' && <button type="button" className="button button-secondary" disabled={busy} onClick={() => switchTask({ kind: 'lab', row: report })}>
                  {needsReview ? 'Review result' : 'View result'}
                </button>}
              </li>;
            })}</ul>
          </section>}
        </>}
        <Field label="Reason for visit">
          <input required value={form.visitReason} onChange={e => set('visitReason', e.target.value)} maxLength={200} />
        </Field>
        {structured ? <ClinicalFields value={clinical} onChange={setClinical}>
          <Field label="Additional notes"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} maxLength={5000} /></Field>
        </ClinicalFields> : <>
          <Field label="Consultation notes"><textarea required value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} maxLength={5000} /></Field>
          <button className="button button-secondary" type="button" onClick={() => setStructured(true)}>Add clinical sections</button>
        </>}
        {editing && <Field label="Reason for correction" error={correctionShort ? 'Explain the correction in at least 12 characters.' : undefined}>
          <textarea required minLength={12} maxLength={1000} value={form.reason} onChange={e => set('reason', e.target.value)} />
        </Field>}
        {vitalsInvalid && <p className="form-error" role="alert">Check the highlighted vital signs before saving.</p>}
        {error && <div className="form-error" role="alert"><strong>Unable to save</strong><p>{error}</p></div>}
        {!editing && !!tests.length && <details className="form-disclosure">
          <summary>More consultation actions</summary>
          <div className="patient-actions">{draftActions}</div>
        </details>}
        {footer(editing ? 'Complete correction' : 'Complete consultation', editing ? 'correct' : 'sign', !editing && !tests.length ? draftActions : undefined, visitBlocked, editing ? 'Saving correction…' : 'Completing…')}
        {!editing && <details className="form-disclosure">
          <summary>Cancel unfinished consultation</summary>
          <p className="form-intro">Cancel this open consultation if the patient left before being seen or it was opened in error.</p>
          <Field label="Reason for cancelling"><textarea rows={2} maxLength={1000} value={form.cancelReason} onChange={e => set('cancelReason', e.target.value)} placeholder="Explain in at least 12 characters. Active lab requests must be cancelled first." /></Field>
          <div className="form-actions"><button type="submit" name="action" value="cancel" formNoValidate onClick={() => { pendingAction.current = 'cancel'; }} className="button button-secondary" disabled={busy || form.cancelReason.trim().length < 12}>{busyAction === 'cancel' ? 'Cancelling…' : 'Cancel consultation'}</button></div>
        </details>}
      </>}
      {Array.isArray(row.history) && row.history.length > 0 && <details className="form-disclosure">
        <summary>Earlier signed versions ({row.history.length})</summary>
        {row.history.map((h: any, i: number) => <div className="previous-version" key={i}>
          <p className="clinical-notes">{h.notes}</p>
          <ClinicalReadout value={h.clinical} />
          <small>{h.changedBy} · {formatTime(h.changedAt)}</small>
          <p>Reason: {h.reason}</p>
        </div>)}
      </details>}
    </>;
  } else if (kind === 'lab-new') {
    title = 'Request laboratory test';
    const testNames = data.labTestNames || [];
    fields = <>{patientSelect(true)}{testNames.length ? <>
      <TestPicker tests={testNames} value={form.testName} onChange={name => set('testName', name)} disabled={busy} />
      <p className="source-line">Laboratory will receive this test request for the selected visit.</p>
      <div className="form-actions"><button type="submit" onClick={() => { pendingAction.current = 'save'; }} className="button button-primary" disabled={busy || !testNames.includes(form.testName)}>{busyAction === 'save' ? 'Sending…' : 'Send request'}</button></div>
    </> : <p className="notice-inline">No laboratory tests are available. Ask the account manager to enable the tests the clinic offers under Service prices.</p>}</>;
  } else if (kind === 'lab') {
    title = 'Laboratory report'; const patient = data.patients.find(p => p.id === row.patientId); const canEdit = role === 'laboratory' && (!['approved', 'cancelled'].includes(row.status) || editing);
    const visitRow = data.visits.find(v => v.id === row.visitId);
    const flexIsQual = form.unit === 'Not applicable';
    const flexUnitVal = form.unit || '';
    const flexUnitInvalid = !!flexUnitVal && !flexIsQual && (() => { try { cleanLabUnit(flexUnitVal, false); return false; } catch { return true; } })();
    const flexUnitError = flexUnitInvalid ? 'Choose a standard laboratory unit (e.g. mg/dL, mmol/L, g/dL, %, 10^9/L, /hpf, or Not applicable).' : undefined;
    const flexResultError = labResultError(form.value, form.unit) || undefined;
    const specimenError = form.specimen.trim() ? (() => { try { cleanDescriptiveLabel(form.specimen, 'Sample type', 120, false); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid sample type containing letters.'; } })() : '';
    const contactPersonError = form.urgency === 'urgent' && form.contactPerson.trim() ? (() => { try { cleanPersonName(form.contactPerson, 'Staff member contacted', 120); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid full name.'; } })() : '';
    const contactMethodOptions = form.contactMethod && !URGENT_CONTACT_METHODS.includes(form.contactMethod)
      ? [...URGENT_CONTACT_METHODS, form.contactMethod]
      : [...URGENT_CONTACT_METHODS];
    const check = () => {
      let problems: string[];
      try { problems = labProblems({ ...row, ...form, layout, measurements, collectedAt: isoTime(form.collectedAt) }, visitRow); }
      catch { problems = ['Enter a valid collection date and time.']; }
      if (measurements.length) {
        for (const msg of measurementProblems(measurements)) {
          if (!problems.includes(msg)) problems.push(msg);
        }
      } else if (layout === 'general') {
        if (flexUnitInvalid) problems.push('Choose a standard laboratory unit (e.g. mg/dL, mmol/L, g/dL, %, 10^9/L, /hpf, or Not applicable).');
        if (flexResultError) problems.push(flexResultError);
      }
      if (specimenError) problems.push(specimenError);
      if (form.urgency === 'urgent') {
        if (!form.contactPerson.trim() || !form.contactMethod.trim() || !form.contactAt) {
          problems.push('For an urgent report, record the staff member contacted, contact method and contact time.');
        } else {
          if (contactPersonError) problems.push(contactPersonError);
          try {
            const contactIso = isoTime(form.contactAt);
            const contactTime = Date.parse(contactIso);
            if (!Number.isFinite(contactTime) || contactTime > Date.now() + 60_000) problems.push('Enter a valid contact time that is not in the future.');
            else {
              if (form.collectedAt) {
                try {
                  const collectedTime = Date.parse(isoTime(form.collectedAt));
                  if (Number.isFinite(collectedTime) && contactTime < collectedTime) problems.push('Clinician contact time cannot be earlier than the sample collection time.');
                } catch {}
              }
              if (visitRow?.date && clinicDay(new Date(contactTime)) < visitRow.date) problems.push('Clinician contact date cannot be earlier than the visit date.');
            }
          } catch { problems.push('Enter a valid contact time.'); }
        }
      }
      return problems;
    };
    const urgentReady = form.urgency !== 'urgent' || !!(form.contactPerson.trim() && form.contactMethod.trim() && form.contactAt);
    const approvalBlocked = !form.reviewed || !urgentReady || check().length > 0 || editing && form.reason.trim().length < 12;
    const review = row.doctorReview || {};
    const appointmentFields = <div className="form-grid">
      <Field label="Return appointment date (if scheduled)">
        <input type="date" min={row.approvedAt ? clinicDay(new Date(row.approvedAt)) : today()} value={form.followUpDate} onChange={event => {
          const date = event.target.value;
          setForm((current: any) => ({ ...current, followUpDate: date, followUpTime: date ? current.followUpTime : '' }));
          setError('');
        }} />
      </Field>
      <Field label="Return time (optional)" hint="Clinic time, UTC+8.">
        <input type="time" step="60" value={form.followUpTime} disabled={!form.followUpDate} onChange={event => set('followUpTime', event.target.value)} />
      </Field>
    </div>;
    const approvedReport = <>
      <ReportReadout report={row} />
      <div className="patient-actions">
        <PrintLink kind="lab" id={row.id} />
        {role === 'laboratory' && <button className="button button-secondary" type="button" onClick={() => setEditing(true)}>Record a correction</button>}
      </div>
      {role === 'doctor' && needsDoctorReview(row) ? <section className="doctor-review">
        <h3>Review the lab result</h3>
        <p className="form-intro">Record what you discussed with the patient or what you plan to do next.</p>
        <Field label="Doctor’s review notes">
          <textarea rows={3} required maxLength={3000} value={form.reviewPlan} onChange={event => set('reviewPlan', event.target.value)} />
        </Field>
        {appointmentFields}
        <label className="check-field">
          <input type="checkbox" checked={form.reviewConfirmed} onChange={event => set('reviewConfirmed', event.target.checked)} />
          <span>I have reviewed this result.</span>
        </label>
        {footer('Save doctor review', 'doctor-review', undefined, !form.reviewConfirmed || !form.reviewPlan.trim())}
      </section> : review.reviewedAt && <section className="doctor-review">
        <h3>Doctor review saved</h3>
        <p className="clinical-notes">{role === 'doctor' ? review.plan : 'The responsible doctor reviewed this result.'}</p>
        <p className="source-line">{review.reviewedBy} · {formatTime(review.reviewedAt)}</p>
        {role === 'doctor' && (editingAppointment ? <>
          {appointmentFields}
          {footer('Save return appointment', 'return-appointment', <button type="button" className="button button-secondary" disabled={busy} onClick={() => {
            setForm((current: any) => ({ ...current, followUpDate: review.followUpDate || '', followUpTime: review.followUpTime || '' }));
            setEditingAppointment(false); setError('');
          }}>Cancel</button>)}
        </> : <>
          {review.followUpDate && <p className="source-line">Return appointment {formatDate(review.followUpDate)}{review.followUpTime ? ` at ${review.followUpTime}` : ''}</p>}
          <button type="button" className="button button-secondary" onClick={() => setEditingAppointment(true)}>Edit return appointment</button>
        </>)}
      </section>}
    </>;
    fields = <>{patient && <IdentityCard patient={patient} />}<div className="record-summary"><span>{row.id} · {row.visitId}</span><Status value={row.status}>{role === 'doctor' && row.status === 'approved' ? 'Lab approved' : undefined}</Status></div><h3 className="record-test-name">{row.testName}</h3>{canEdit ? <><MeasurementEditor layout={layout} rows={measurements} setLayout={v => { setLayout(v); setCheckResult(null); }} setRows={r => { setMeasurements(r); setCheckResult(null); }} />{!measurements.length && layout === 'general' && <><Field label="Result" hint="Enter the result here. Enter its measurement unit separately below." error={flexResultError}><textarea value={form.value} placeholder={flexIsQual ? 'e.g. Negative, Clear, Yellow' : 'e.g. 92, 5.6, <5, or 2-4'} onChange={e => set('value', e.target.value)} maxLength={3000} rows={3} /></Field><UnitPicker label="Result unit" align="left" value={flexUnitVal} disabled={flexIsQual} error={flexUnitError} onChange={v => set('unit', v)} /><label className="check-field"><input type="checkbox" checked={flexIsQual} onChange={e => set('unit', e.target.checked ? 'Not applicable' : '')} /><span>No unit applies to this result</span></label></>}<div className="form-grid"><SpecimenPicker value={form.specimen} disabled={busy} error={specimenError || undefined} onChange={v => set('specimen', v)} /><Field label="Sample collected on / at" hint="Clinic time, UTC+8."><input type="datetime-local" min={visitRow?.date ? `${visitRow.date}T00:00` : undefined} max={localTime(new Date().toISOString())} value={form.collectedAt} onChange={e => set('collectedAt', e.target.value)} /></Field></div><details className="form-disclosure"><summary>Report comment (optional)</summary><Field label="Laboratory comment"><textarea rows={3} maxLength={2000} value={form.reportComment} onChange={e => set('reportComment', e.target.value)} /></Field></details><Field label="Clinician review priority" hint="Use your laboratory's approved procedure to decide whether immediate contact is needed."><select value={form.urgency} onChange={e => { const nextUrgency = e.target.value; setForm((f: any) => ({ ...f, urgency: nextUrgency, ...(nextUrgency === 'routine' ? { contactPerson: '', contactMethod: '', contactAt: '' } : {}) })); setError(''); setCheckResult(null); }}><option value="routine">Routine review</option><option value="urgent">Urgent: clinician contacted</option></select></Field>{form.urgency === 'urgent' && <div className="urgent-handoff"><p>Contact the responsible clinician directly. Record the completed contact before approving.</p><Field label="Staff member contacted" error={contactPersonError || undefined}><input list="clinic-staff-names" placeholder="e.g. Dr. Ian Mark Buenaflor" maxLength={120} value={form.contactPerson} onChange={e => set('contactPerson', sanitizeNamePartInput(e.target.value, 120))} /></Field><datalist id="clinic-staff-names">{data.staff.filter(s => s.active !== false).map(s => <option key={s.id} value={s.name} />)}</datalist><Field label="Contact method"><select value={form.contactMethod} onChange={e => set('contactMethod', e.target.value)}><option value="">Choose contact method</option>{contactMethodOptions.map(method => <option key={method} value={method}>{method}</option>)}</select></Field><Field label="Contact date and time"><input type="datetime-local" min={form.collectedAt || (visitRow?.date ? `${visitRow.date}T00:00` : undefined)} max={localTime(new Date().toISOString())} value={form.contactAt} onChange={e => set('contactAt', e.target.value)} /></Field></div>}<button type="button" className="button button-secondary" onClick={() => setCheckResult(check())}><ClipboardCheck size={16} />Check report details</button>{checkResult && <div className={`check-result ${checkResult.length ? 'check-result-warning' : 'check-result-good'}`} role="status">{checkResult.length ? <ul>{checkResult.map(problem => <li key={problem}>{problem}</li>)}</ul> : <p><Check size={16} />Required details are complete. Review the content before approval.</p>}</div>}<label className="check-field"><input type="checkbox" checked={form.reviewed} onChange={e => set('reviewed', e.target.checked)} /><span>I checked the patient, request and report content.</span></label>{editing && <Field label="Reason for correction"><textarea required minLength={12} maxLength={1000} rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} /></Field>}<p className="source-line" id="lab-approval-help">Complete the required details and confirm the report check before approving.</p>{footer(editing ? 'Approve correction' : 'Approve report', editing ? 'correct' : 'approve', !editing ? <button type="submit" name="action" value="save" onClick={() => { pendingAction.current = 'save'; }} className="button button-secondary" disabled={busy}>{busyAction === 'save' ? 'Saving draft…' : 'Save draft'}</button> : undefined, approvalBlocked, editing ? 'Approving correction…' : 'Approving…')}</> : row.status === 'approved' ? approvedReport : row.status === 'cancelled' ? <p className="notice-inline">This laboratory request was cancelled.</p> : <p className="notice-inline">Laboratory staff are completing this report. Result content becomes available after approval.</p>}{((role === 'laboratory' && ['requested', 'draft'].includes(row.status)) || (role === 'doctor' && row.status === 'requested')) && !editing && <details className="form-disclosure"><summary>Cancel laboratory request</summary><p className="form-intro">Cancel this request if it was ordered in error or the specimen could not be processed.</p><Field label="Reason for cancelling"><textarea rows={2} maxLength={1000} value={form.cancelReason} onChange={e => set('cancelReason', e.target.value)} placeholder="Explain in at least 12 characters." /></Field><div className="form-actions"><button type="submit" name="action" value="cancel" formNoValidate onClick={() => { pendingAction.current = 'cancel'; }} className="button button-secondary" disabled={busy || form.cancelReason.trim().length < 12}>{busyAction === 'cancel' ? 'Cancelling…' : 'Cancel request'}</button></div></details>}<p className="source-line">Source: {row.sourceRef}. Report version {row.version || '—'}.</p>{Array.isArray(row.history) && row.history.length > 0 && <details className="form-disclosure"><summary>Earlier approved versions ({row.history.length})</summary>{row.history.map((h: any, i: number) => <div className="previous-version" key={i}><ReportReadout report={h} /><p>Correction: {h.reason}</p><small>{h.changedBy} · {formatTime(h.changedAt)}</small></div>)}</details>}</>;
  } else if (kind === 'invoice') {
    title = 'Bill and payments';
    const patient = data.patients.find(p => p.id === row.patientId);
    const remaining = row.total - row.paid;
    const amount = Math.round(Number(form.amount || 0) * 100);
    const paymentError = form.amount.trim() ? (() => { try { validatePayment(form.amount, row.total, row.paid); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid payment amount.'; } })() : '';
    const referenceMissing = form.method !== 'Cash' && !form.reference.trim();
    const paymentBlocked = !form.amount.trim() || !!paymentError || referenceMissing;
    fields = <>
      {patient && <IdentityCard patient={patient} />}
      <div className="record-summary"><span>{row.id} · {row.visitId}</span><Status value={remaining <= 0 ? 'paid' : row.paid ? 'partial' : 'unpaid'} /></div>
      <div className="invoice-extra-action">
        <PrintLink kind="bill" id={row.id} />
        <button type="button" className="text-button" onClick={() => switchTask({ kind: 'invoice-add', row })}><Plus size={16} />Add completed services</button>
      </div>
      <div className="bill-lines">{row.items.map((item: any, i: number) => <div key={i}>
        <div className="bill-line-service"><span>{item.description}</span><ChargeOrigin item={item} /></div>
        <strong>{formatMoney(item.amount)}</strong>
      </div>)}</div>
      <div className="bill-total"><span>Total charges</span><strong>{formatMoney(row.total)}</strong></div>
      <div className="bill-total"><span>Payments received</span><strong>{formatMoney(row.paid)}</strong></div>
      <div className="bill-total outstanding"><span>Remaining balance</span><strong>{formatMoney(remaining)}</strong></div>
      {remaining > 0 && <section className="invoice-payment-form" aria-labelledby="payment-form-title">
        <h3 id="payment-form-title">Record a payment</h3>
        <p className="form-intro">Enter the amount the patient paid now.</p>
        <div className="form-grid">
          <Field label="Amount received (PHP)" error={paymentError || undefined}><input type="text" inputMode="decimal" placeholder="0.00" required maxLength={10} value={form.amount} onChange={e => set('amount', sanitizeDecimalInput(e.target.value, 2, 7))} /></Field>
          <Field label="Payment method"><select value={form.method} onChange={e => set('method', e.target.value)}><option>Cash</option><option>Card</option><option>Bank transfer</option></select></Field>
        </div>
        <Field label={form.method === 'Cash' ? 'Reference (optional)' : 'Payment reference'} error={referenceMissing ? 'Enter a reference number for this payment method.' : undefined}><input required={form.method !== 'Cash'} placeholder="e.g. Card approval code or bank transfer reference" value={form.reference} maxLength={120} onChange={e => set('reference', e.target.value)} /></Field>
        <div className="payment-preview">
          <span>{amount > remaining ? 'Amount exceeds the remaining balance' : 'Remaining after this payment'}</span>
          {amount <= remaining && <strong>{formatMoney(remaining - amount)}</strong>}
        </div>

        {footer('Record payment', 'save', undefined, paymentBlocked)}
      </section>}
      {error && <div className="form-error" role="alert"><strong>Unable to save</strong><p>{error}</p></div>}
      {row.payments.length > 0 && <details className="form-disclosure">
        <summary>Payment history ({row.payments.length})</summary>
        {row.payments.map((p: any) => <div className="previous-version" key={p.id}>
          <strong>{formatMoney(p.amount)} · {p.method}</strong>
          <p>{p.reference || 'No reference supplied'}</p>
          <small>{p.by} · {formatTime(p.at)}</small>
          {p.voidedAt ? <>
            <div><Status value="cancelled">Voided</Status></div>
            <p className="source-line">Voided by {p.voidedBy} · {formatTime(p.voidedAt)}. Reason: {p.voidReason}</p>
          </> : <>
            <PrintLink kind="receipt" id={row.id} payment={p.id} label="Print payment receipt" />
            <details className="form-disclosure">
              <summary>Void payment</summary>
              <Field label="Reason for voiding"><textarea rows={2} maxLength={1000} value={voidReasons[p.id] || ''} onChange={e => setVoidReasons(current => ({ ...current, [p.id]: e.target.value }))} placeholder="Explain in at least 12 characters." /></Field>
              <div className="form-actions"><button type="button" className="button button-secondary" disabled={busy || (voidReasons[p.id] || '').trim().length < 12} onClick={() => void voidPayment(p.id)}>{busyAction === `void:${p.id}` ? 'Voiding…' : 'Void payment'}</button></div>
            </details>
          </>}
        </div>)}
      </details>}
    </>;
  } else if (kind === 'review') {
    title = 'Check patient identity'; const incoming = data.imports.find(i => i.id === row.recordId); const p = incoming?.payload;
    fields = <><p className="form-intro">Keep the source record separate until the identity and visit are confirmed.</p>{p && <div className="incoming-identity"><strong>Incoming {incoming.externalId}</strong><dl><div><dt>Patient name</dt><dd>{p.patientName || 'Missing'}</dd></div><div><dt>Patient number</dt><dd>{p.patientId || 'Missing'}</dd></div><div><dt>Birth date</dt><dd>{p.patientDob ? formatDate(p.patientDob) : 'Missing'}</dd></div><div><dt>Visit</dt><dd>{p.visitId || 'Missing'}</dd></div></dl></div>}<Field label="Decision"><select value={form.decision} onChange={e => set('decision', e.target.value)}><option value="keep-separate">Keep the records separate</option><option value="link">Link after confirming the patient</option></select></Field>{form.decision === 'link' && <>{patientSelect(true)}<Field label="Birth date verified from the original source"><input type="date" required max={today()} value={form.confirmedDob} onChange={e => set('confirmedDob', e.target.value)} /></Field></>}<Field label="Evidence checked and reason for this decision"><textarea rows={4} value={form.evidence} onChange={e => set('evidence', e.target.value)} required minLength={12} maxLength={1000} /></Field>{footer('Save decision')}</>;
  } else if (kind === 'staff-reset') {
    title = 'Reset staff password';
    const passwordError = form.password ? (form.password.length < 12 ? 'Use a password with at least 12 characters.' : form.password === 'CareRecord2026!' ? 'Choose an individual temporary password instead of the shared setup password.' : '') : '';
    const staffReasonShort = form.reason.trim().length > 0 && form.reason.trim().length < 12 ? 'Explain in at least 12 characters.' : '';
    const resetBlocked = !form.password || !!passwordError || form.reason.trim().length < 12;
    fields = <><p className="form-intro"><strong>{row.name}</strong><br />{row.username}</p><Field label="Temporary password" hint="At least 12 characters. Give it to the verified staff member privately." error={passwordError || undefined}><input type="password" autoComplete="new-password" value={form.password} required minLength={12} maxLength={200} onChange={e => set('password', e.target.value)} /></Field><Field label="Identity verification and reset reason" error={staffReasonShort || undefined}><textarea rows={3} required minLength={12} maxLength={1000} value={form.reason} onChange={e => set('reason', e.target.value)} /></Field><p className="source-line">Existing sessions will end. The staff member must choose a new password before accessing records.</p>{footer('Set temporary password', 'save', undefined, resetBlocked)}</>;
  } else if (kind === 'staff-new' || kind === 'staff-edit') {
    title = kind === 'staff-new' ? 'Add staff account' : 'Manage staff access';
    const validStaffPart = (val: string, label: string) => {
      const t = String(val || '').trim();
      if (!t) return '';
      if (!/\p{L}/u.test(t) || !/^[\p{L}\p{M} .'’-]+$/u.test(t)) return `Enter a valid ${label.toLowerCase()} using letters, spaces, periods, hyphens or apostrophes.`;
      return '';
    };
    const staffFirstError = kind === 'staff-new' ? validStaffPart(form.firstName, 'First name') : '';
    const staffLastError = kind === 'staff-new' ? validStaffPart(form.lastName, 'Last name') : '';
    const composedStaffName = kind === 'staff-new' ? composePersonName({ title: form.title, firstName: form.firstName, lastName: form.lastName }) : '';
    const staffComposedError = kind === 'staff-new' && form.firstName.trim() && form.lastName.trim() && !staffFirstError && !staffLastError
      ? (() => { try { cleanPersonName(composedStaffName, 'Staff name', 120); return ''; } catch (e) { return e instanceof Error ? e.message : 'Enter a valid staff name.'; } })()
      : '';
    const usernameError = kind === 'staff-new' && form.username.length > 0 && form.username.length < 3 ? 'Use at least 3 characters (letters, digits, dots, underscores or hyphens).' : '';
    const passwordError = kind === 'staff-new' && form.password ? (form.password.length < 12 ? 'Use a password with at least 12 characters.' : form.password === 'CareRecord2026!' ? 'Use an individual temporary password instead of the shared setup password.' : '') : '';
    const staffReasonShort = kind === 'staff-edit' && form.reason.trim().length > 0 && form.reason.trim().length < 12 ? 'Explain in at least 12 characters.' : '';
    const staffBlocked = kind === 'staff-new'
      ? !form.firstName.trim() || !form.lastName.trim() || !!staffFirstError || !!staffLastError || !!staffComposedError || form.username.length < 3 || !!usernameError || !form.password || !!passwordError
      : form.reason.trim().length < 12;
    fields = <>{kind === 'staff-new' ? <><div className="form-grid"><Field label="Title (optional)"><select value={form.title} onChange={e => set('title', e.target.value)}>{STAFF_TITLES.map(t => <option key={t || 'none'} value={t}>{t || 'None'}</option>)}</select></Field><Field label="First name" error={staffFirstError || undefined}><input required maxLength={50} placeholder="e.g. Elena" value={form.firstName} onChange={e => set('firstName', sanitizeNamePartInput(e.target.value, 50))} autoComplete="off" /></Field></div><Field label="Last name" error={staffLastError || staffComposedError || undefined}><input required maxLength={50} placeholder="e.g. Santos" value={form.lastName} onChange={e => set('lastName', sanitizeNamePartInput(e.target.value, 50))} autoComplete="off" /></Field><Field label="Username" hint="3–40 lowercase letters, digits, dots, underscores or hyphens (e.g. dr.santos)." error={usernameError || undefined}><input value={form.username} onChange={e => set('username', sanitizeUsernameInput(e.target.value))} required pattern="[a-z0-9._-]{3,40}" minLength={3} maxLength={40} autoComplete="off" /></Field><Field label="Password" hint="At least 12 characters. Give this to the staff member privately." error={passwordError || undefined}><input type="password" autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={12} maxLength={200} /></Field></> : <div className="form-intro"><strong>{row.name}</strong><br />{row.username}<br /><button type="button" className="text-button" onClick={() => switchTask({ kind: 'staff-reset', row })}>Reset password after verifying identity</button></div>}<Field label="Assigned role"><select value={form.role} onChange={e => set('role', e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}</select></Field>{kind === 'staff-edit' && <><label className="check-field"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} /><span>Allow this account to sign in</span></label><Field label="Reason for changing access" error={staffReasonShort || undefined}><textarea required minLength={12} maxLength={1000} rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} /></Field><p className="source-line">Existing sessions for this account will end after the change.</p></>}{footer(kind === 'staff-new' ? 'Create account' : 'Save access', 'save', undefined, staffBlocked)}</>;
  } else { title = 'Record unavailable'; fields = <p>This record is no longer available. Close this view and refresh the workspace.</p>; }
  const canRelease = kind === 'lab' && role === 'doctor' && row.status === 'approved' && row.doctorReview?.reviewedAt && !needsDoctorReview(row);
  const reportVisit = canRelease ? data.visits.find(visit =>
    visit.id === row.visitId && visit.patientId === row.patientId && visit.doctorId === data.user.id
    && ['draft', 'signed'].includes(visit.status)
  ) : undefined;
  return <Dialog title={title} onClose={onClose} busy={busy} hasUnsavedChanges={hasUnsavedChanges} pendingChange={nextTask ? {
    proceed: () => { setNextTask(null); void onSaved('', nextTask); },
    cancel: () => setNextTask(null),
  } : undefined}><form onSubmit={submit}>{fields}
    {canRelease && !editingAppointment && <section className="doctor-review"><h3>Patient portal</h3>
      {row.doctorReview.releasedAt ? <p className="notice-inline">Shared in the patient portal on {formatTime(row.doctorReview.releasedAt)}.</p> : <>
        <p className="form-intro">Share this result to make it visible in the patient’s portal.</p>
        <label className="check-field"><input type="checkbox" checked={!!form.releaseConfirmed} onChange={event => set('releaseConfirmed', event.target.checked)} /><span>I confirm this result is ready to share with the patient.</span></label>
      </>}
      <div className="form-actions">
        {reportVisit && <button type="button" className="button button-secondary" disabled={busy} onClick={() => switchTask({ kind: 'visit', row: reportVisit })}>
          {reportVisit.status === 'signed' ? 'View completed consultation' : 'Return to consultation'}
        </button>}
        {!row.doctorReview.releasedAt && <button type="submit" name="action" value="patient-release" onClick={() => { pendingAction.current = 'patient-release'; }} className="button button-primary" disabled={busy || !form.releaseConfirmed}>{busyAction === 'patient-release' ? 'Sharing…' : 'Share with patient'}</button>}
      </div>
    </section>}
    {kind !== 'invoice' && kind !== 'visit' && error && <div className="form-error" role="alert"><strong>Unable to save</strong><p>{error}</p></div>}</form></Dialog>;
}
