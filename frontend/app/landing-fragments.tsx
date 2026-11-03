'use client';
import { useState } from 'react';
import { ArrowRight, CircleAlert, CircleCheck, UsersRound, FlaskConical, ReceiptText, LayoutDashboard, ListChecks, ChartNoAxesCombined, Database, ShieldCheck, Stethoscope } from 'lucide-react';
import { Brand, Status, IdentityCard } from '@/components/ui/common';
import { RecordChart } from '@/components/ui/record-chart';
const SAMPLE = { id: 'P-0001', name: 'Ana Reyes', dob: '2002-05-15' };
export function WorkspacePreview({ view = 'patients' }: { view?: string }) {
  const rows = [['Ana Reyes', 'P-0001', '15 May 2002', 'Dr. Ian Mark Buenaflor'], ['Gabriel Flores', 'P-0002', '7 Nov 1989', 'Dr. Miguel Lim'], ['Isabel Mendoza', 'P-0003', '22 Mar 1995', 'Dr. Ian Mark Buenaflor'], ['Marco Villanueva', 'P-0004', '14 Aug 1978', 'Dr. Ian Mark Buenaflor']];
  const nav = [[LayoutDashboard, 'Overview', 'overview'], [UsersRound, 'Patients', 'patients'], [Stethoscope, 'Consultations', 'visits'], [FlaskConical, 'Laboratory', 'laboratory'], [ReceiptText, 'Billing', 'billing'], [ListChecks, 'Record checks', 'review'], [ChartNoAxesCombined, 'Reports', 'reports']] as const;
  return <div className="preview-app" data-ui role="tabpanel" id="showcase-panel" aria-label="Clinic workspace preview"><aside className="preview-sidebar"><Brand small />{nav.map(([Icon, name, id]) => <div key={id} className={`preview-nav-row ${id === view ? 'selected' : ''}`}><Icon size={14} strokeWidth={1.5} />{name}</div>)}</aside><div className="preview-main"><div className="preview-top"><div><h3>{view === 'patients' ? 'Patients' : view === 'laboratory' ? 'Laboratory' : view === 'review' ? 'Record checks' : 'Reports'}</h3><p>Patient reception · Connected visit records</p></div><span className="preview-add">{view === 'patients' ? '+ Register patient' : view === 'reports' ? 'Refresh copies' : 'Access for each job'}</span></div>{view === 'patients' ? <><div className="metric-strip"><div><span>Patient records</span><strong>{rows.length}</strong></div><div><span>Shown in this preview</span><strong>{rows.length}</strong></div><div><span>Departments connected</span><strong>3</strong></div></div><table><thead><tr><th>Patient</th><th>Birth date</th><th>Assigned doctor</th><th /></tr></thead><tbody>{rows.map(([name, id, dob, doctor]) => <tr key={id}><td><strong>{name}</strong><small>{id}</small></td><td>{dob}</td><td>{doctor}</td><td><ArrowRight size={13} /></td></tr>)}</tbody></table><p className="fragment-note">A permanent patient number connects each department’s records.</p></> : <DemoFragment type={view === 'laboratory' ? 1 : view === 'review' ? 2 : 3} />}</div></div>;
}

function ReportCheckPreview() {
  const [time, setTime] = useState('');
  const [checked, setChecked] = useState(false);
  const missingTime = checked && !time;
  const ResultIcon = missingTime ? CircleAlert : CircleCheck;

  return <form className="fragment report-check-preview" data-ui onSubmit={event => {
    event.preventDefault();
    setChecked(true);
  }}>
    <div className="fragment-header"><h3>Check a test report</h3><Status value="draft">Draft</Status></div>
    <p className="form-intro">{SAMPLE.name} · {SAMPLE.id} · Report L-0032</p>
    <div className="report-example-result">
      <div><span>Blood glucose</span><div className="report-example-reading"><strong>92</strong><small>mg/dL</small></div></div>
      <p>Sample report</p>
    </div>
    <label className="field report-time-field">
      <span>Time the sample was taken</span>
      <input type="time" value={time} aria-invalid={missingTime || undefined} onChange={event => {
        setTime(event.target.value);
        setChecked(false);
      }} />
    </label>
    <button className="button button-primary" type="submit">Check details<ArrowRight size={15} aria-hidden="true" /></button>
    <div className="report-check-feedback" role="status">
      {checked && <p className={`check-result ${missingTime ? 'check-result-warning' : 'check-result-good'}`}>
        <ResultIcon size={17} aria-hidden="true" />
        {missingTime ? 'Add the time before this report can be approved.' : 'Time added. Laboratory staff still need to check the report before approving it.'}
      </p>}
    </div>
  </form>;
}

export function DemoFragment({ type }: { type: number }) {
  const [role, setRole] = useState('doctor');
  if (type === 1) return <ReportCheckPreview />;
  return <div className="fragment" data-ui>{type === 0 ? <><div className="fragment-header"><h3>Patient visit</h3><span className="muted">V-0024</span></div><IdentityCard patient={SAMPLE} /><div className="simple-row"><span>Registration</span><Status value="approved">Identity checked</Status></div><div className="simple-row"><span>Consultation</span><Status value="draft" /></div><div className="simple-row"><span>Laboratory report</span><Status value="draft" /></div><div className="simple-row"><span>Billing</span><span className="muted">Linked to visit</span></div><p className="fragment-note">One patient. A separate number for each visit.</p></> : type === 2 ? <><div className="fragment-header"><h3>Access for each job</h3><ShieldCheck size={17} /></div><IdentityCard patient={SAMPLE} /><div className="role-preview" aria-label="Compare sample views"><button aria-pressed={role === 'doctor'} onClick={() => setRole('doctor')}>Doctor</button><button aria-pressed={role === 'billing'} onClick={() => setRole('billing')}>Billing</button></div><div className="simple-row"><strong>{role === 'doctor' ? 'Consultation notes' : 'Bill B-0001'}</strong><span>{role === 'doctor' ? 'Assigned patient' : '₱750.00'}</span></div><div className="simple-row"><span>{role === 'doctor' ? 'Laboratory report' : 'Payment status'}</span><Status value={role === 'doctor' ? 'draft' : 'unpaid'} /></div><p className="fragment-note">This example compares views. Actual staff permissions are assigned to their accounts.</p></> : <><div className="fragment-header"><h3>Records used in reports</h3><Database size={17} /></div><p className="form-intro">Records by department in this example</p><RecordChart labels={['Clinic', 'Laboratory', 'Billing']} values={[16, 6, 10]} label="Reporting copies by department" /><div className="simple-row"><span>Records in this example</span><strong>32</strong></div><p className="fragment-note">The report shows where its information came from and when it was updated.</p></>}</div>;
}

export function VisitJourney() {
  const steps = [
    { name: 'Registration', note: 'Confirm the patient and check them in.', handoff: 'The assigned doctor receives a waiting visit linked to Ana’s patient number.' },
    { name: 'Consultation', note: 'Record findings and the care plan.', handoff: 'If a test is needed, the doctor sends the laboratory a request linked to this visit.' },
    { name: 'Laboratory', note: 'Check and approve the test report.', handoff: 'The approved report goes back to the doctor for review and a follow-up decision.' },
    { name: 'Billing', note: 'Prepare charges and record payments.', handoff: 'After the consultation is complete, billing prepares the bill and records each payment received.' },
  ];
  const [selected, setSelected] = useState(0);

  return <div className="visit-ledger" data-ui>
    <div className="visit-identity" data-landing-motion="copy">
      <div><span>Patient record</span><strong>{SAMPLE.name}</strong></div>
      <dl><div><dt>Patient number</dt><dd>{SAMPLE.id}</dd></div><div><dt>Birth date</dt><dd>15 May 2002</dd></div><div><dt>Visit number</dt><dd>V-0024</dd></div></dl>
    </div>
    <div className="visit-route">
      <div className="visit-route-heading"><h3>Follow Ana’s visit</h3><p>Choose a step to see what happens next.</p></div>
      <ol className="visit-departments" data-landing-motion="journey" aria-label="Steps in Ana’s visit">
        {steps.map((step, index) => <li key={step.name}>
          <button type="button" aria-pressed={selected === index} aria-controls="visit-handoff" onClick={() => setSelected(index)}>
            <span className="visit-step-number" aria-hidden="true">{index + 1}</span>
            <span className="visit-step-copy"><strong>{step.name}</strong><span>{step.note}</span></span>
          </button>
        </li>)}
      </ol>
      <div className="visit-handoff" id="visit-handoff" role="status">
        <ArrowRight size={18} aria-hidden="true" />
        <div><strong>After {steps[selected].name.toLowerCase()}</strong><p key={selected}>{steps[selected].handoff}</p></div>
      </div>
    </div>
  </div>;
}

export function AccessComparison() {
  return <div className="access-comparison" data-landing-motion="roles" data-ui>
    <div className="access-shared-patient"><IdentityCard patient={SAMPLE} /></div>
    <div className="access-branches" aria-hidden="true" />
    <div className="access-views">
      <article className="access-view">
        <div className="access-view-heading"><h3><Stethoscope size={19} aria-hidden="true" />Doctor view</h3><span>Assigned patients</span></div>
        <div className="simple-row"><strong>Assessment and care plan</strong><span>Available</span></div>
        <div className="simple-row"><span>Laboratory report</span><Status value="draft" /></div>
        <div className="simple-row"><span>History and medicines</span><span>Available</span></div>
        <p>The assigned doctor reviews approved reports and records the follow-up decision.</p>
      </article>
      <article className="access-view">
        <div className="access-view-heading"><h3><ReceiptText size={19} aria-hidden="true" />Billing view</h3><span>Charges and payments</span></div>
        <div className="simple-row"><strong>Bill B-0001</strong><span>₱750.00</span></div>
        <div className="simple-row"><span>Payment received</span><span>₱500.00</span></div>
        <div className="simple-row"><span>Remaining balance</span><strong>₱250.00</strong></div>
        <p>Billing records payments and prints receipts. Clinical notes and result values stay with the care team.</p>
      </article>
    </div>
  </div>;
}

export function ReportingPreview() {
  const sources = [{ name: 'Clinic', count: 16, detail: 'Completed consultations' }, { name: 'Laboratory', count: 6, detail: 'Approved test reports' }, { name: 'Billing', count: 10, detail: 'Checked bills' }];
  const total = sources.reduce((sum, source) => sum + source.count, 0);
  return <div className="report-specimen" data-ui data-landing-motion="report">
    <div className="report-plot"><div className="report-plot-heading"><h3>Records by department</h3><span>Example reporting collection</span></div><RecordChart labels={sources.map(s => s.name)} values={sources.map(s => s.count)} label="Reporting copies: Clinic 16, Laboratory 6, Billing 10" height={240} /></div>
    <div className="report-source-ledger"><div className="report-total"><strong>{total}</strong><span>checked reporting copies</span></div><dl>{sources.map(source => <div key={source.name}><dt>{source.name}<small>{source.detail}</small></dt><dd>{source.count}</dd></div>)}</dl><p>These example counts describe reporting copies, not different patients. The working reports show their sources, period and update time.</p></div>
  </div>;
}


export function DocumentPreview() {
  return <div className="document-stage" data-ui data-landing-motion="paper"><div className="document-paper"><span className="paper-brand">CareRecord</span><h3>Laboratory report</h3><p className="paper-subtitle">Contents of an approved, printable report</p><dl><div><dt>Patient and visit</dt><dd>Identification linked to the saved record</dd></div><div><dt>Results and units</dt><dd>Each included measurement, clearly named</dd></div><div><dt>Sample and approval</dt><dd>Recorded times and responsible staff</dd></div><div><dt>Saved record reference</dt><dd>A reference to the approved record</dd></div></dl><p className="paper-footnote">Print or save as PDF from the saved report.</p></div><p className="document-preview-caption">Document layout illustration</p></div>;
}
