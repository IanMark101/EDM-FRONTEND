'use client';
import type { ReactNode } from 'react';
import { Plus, Trash2, Printer } from 'lucide-react';
import { Field, formatTime } from '@/components/ui/common';
import { sanitizeDecimalInput } from '@shared/domain';
import { LAB_LAYOUTS, VITAL_FIELDS, VITAL_BOUNDS, cleanLabUnit, labResultError, templateRows, vitalErrors, type Measurement } from '@shared/clinical';
import { UnitPicker } from '@/components/ui/unit-picker';

export const emptyClinical = () => ({ structured: true, history: '', allergyStatus: 'unknown', allergies: '', medicines: '', findings: '', assessment: '', plan: '', vitals: {} });
export function PrintLink({ kind, id, payment, label = 'Print / save PDF' }: { kind: string; id: string; payment?: string; label?: string }) {
  return <a className="button button-secondary row-button" href={`/api/documents/${kind}/${encodeURIComponent(id)}${payment ? `?payment=${encodeURIComponent(payment)}` : ''}`} target="_blank" rel="noopener noreferrer"><Printer size={15} />{label}</a>;
}
export function ClinicalFields({ value, onChange, children }: { value: any; onChange: (value: any) => void; children: ReactNode }) {
  const set = (key: string, text: any) => onChange({ ...value, [key]: text });
  const errors = vitalErrors(value.vitals);
  const allergyError = value.allergyStatus === 'recorded' && !String(value.allergies || '').trim() ? 'Enter the reported allergy and reaction details.' : undefined;
  return <>
    <Field label="Assessment" hint="What did you conclude during the visit?">
      <textarea required rows={2} maxLength={5000} placeholder="e.g. Possible hyperglycemia; dizziness for evaluation" value={value.assessment} onChange={e => set('assessment', e.target.value)} />
    </Field>
    <Field label="Care plan" hint="What should happen next?">
      <textarea required rows={2} maxLength={5000} placeholder="e.g. Request blood glucose test and review result before discharge" value={value.plan} onChange={e => set('plan', e.target.value)} />
    </Field>
    <details className="form-disclosure">
      <summary>More visit details (optional)</summary>
      <Field label="Examination findings">
        <textarea rows={2} maxLength={5000} value={value.findings} onChange={e => set('findings', e.target.value)} />
      </Field>
      {children}
      <h3 className="form-section-title">Patient history</h3>
      <Field label="Relevant patient history">
        <textarea rows={2} maxLength={5000} value={value.history} onChange={e => set('history', e.target.value)} />
      </Field>
      <Field label="Allergies">
        <select value={value.allergyStatus} onChange={e => set('allergyStatus', e.target.value)}>
          <option value="unknown">Not yet confirmed</option>
          <option value="none">No known allergies reported</option>
          <option value="recorded">Allergies reported</option>
        </select>
      </Field>
      {value.allergyStatus === 'recorded' && <Field label="Allergy and reaction details" error={allergyError}>
        <textarea required rows={2} maxLength={5000} placeholder="Describe the substance and reaction." value={value.allergies} onChange={e => set('allergies', e.target.value)} />
      </Field>}
      <Field label="Current medicines">
        <textarea rows={2} maxLength={5000} value={value.medicines} onChange={e => set('medicines', e.target.value)} />
      </Field>
      <h3 className="form-section-title">Measurements taken during this visit</h3>
      <div className="form-grid">{VITAL_FIELDS.map(([key, label, unit]) => { const [min, max] = VITAL_BOUNDS[key]; return <Field key={key} label={label} hint={`${unit} (${min}–${max})`} error={errors[key]}>
        <input inputMode="decimal" value={value.vitals?.[key] || ''} maxLength={10} onChange={e => set('vitals', { ...value.vitals, [key]: sanitizeDecimalInput(e.target.value, 2, 4) })} />
      </Field>; })}</div>
    </details>
  </>;
}
export function ClinicalReadout({ value }: { value: any }) {
  if (!value?.structured) return null;
  return <div className="clinical-readout">{[['Examination findings', value.findings], ['Assessment', value.assessment], ['Care plan', value.plan]].map(([label, text]) => <section key={label}><h3>{label}</h3><p className="clinical-notes">{text || 'Not recorded'}</p></section>)}<details className="form-disclosure"><summary>Patient context and measurements</summary><h3>Relevant history</h3><p className="clinical-notes">{value.history || 'Not recorded'}</p><h3>Allergy review</h3><p className="clinical-notes">{value.allergyStatus === 'none' ? 'No known allergies reported' : value.allergyStatus === 'recorded' ? value.allergies : 'Not yet confirmed'}</p><h3>Current medicines</h3><p className="clinical-notes">{value.medicines || 'Not recorded'}</p><dl className="report-values">{VITAL_FIELDS.filter(([key]) => value.vitals?.[key]).map(([key, label, unit]) => <div key={key}><dt>{label}</dt><dd>{value.vitals[key]} {unit}</dd></div>)}</dl></details></div>;
}
export function MeasurementEditor({ layout, rows, setLayout, setRows }: { layout: string; rows: Measurement[]; setLayout: (v: string) => void; setRows: (v: Measurement[]) => void }) {
  function choose(next: string) {
    if (next === layout) return;
    if (rows.some(row => row.result || row.reference || row.flag || (layout === 'general' && row.unit)) && !window.confirm('Changing the layout replaces the current measurement rows. Keep the current layout to preserve these entries.')) return;
    setLayout(next); setRows(next === 'general' ? [] : templateRows(next));
  }
  const set = (i: number, key: string, value: string) => setRows(rows.map((r, index) => index === i ? { ...r, [key]: value } : r));
  return <><Field label="Report layout" hint="Use the requested panel. Units use standard UCUM laboratory notation."><select value={layout} onChange={e => choose(e.target.value)}>{LAB_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>{rows.length > 0 && <div className="measurement-editor">{rows.map((row, i) => {
    const isQual = row.unit === 'Not applicable';
    const unitVal = row.unit || '';
    const unitInvalid = !!unitVal && !isQual && (() => { try { cleanLabUnit(unitVal, false); return false; } catch { return true; } })();
    const nameError = row.name.trim() && !/\p{L}/u.test(row.name) ? 'Enter a valid measurement name containing letters.' : undefined;
    const resultError = labResultError(row.result, row.unit) || undefined;
    const unitError = unitInvalid ? 'Choose a standard laboratory unit (e.g. mg/dL, mmol/L, g/dL, %, 10^9/L, /hpf, or Not applicable).' : undefined;
    return <fieldset key={i} className="measurement-row"><legend>Measurement {i + 1}</legend><div className="measurement-main"><Field label="Measurement name" error={nameError}><input value={row.name} placeholder="e.g. Blood glucose" maxLength={120} onChange={e => set(i, 'name', e.target.value)} /></Field><Field label="Result" error={resultError}><input value={row.result} placeholder={isQual ? 'e.g. Negative, Clear, Yellow' : 'e.g. 92, 5.6, <5, or 2-4'} maxLength={500} onChange={e => set(i, 'result', e.target.value)} /></Field><UnitPicker label="Unit" value={unitVal} disabled={isQual} error={unitError} onChange={v => set(i, 'unit', v)} /></div><div className="measurement-options"><label className="check-field"><input type="checkbox" checked={isQual} onChange={e => set(i, 'unit', e.target.checked ? 'Not applicable' : '')} /><span>No unit</span></label><button type="button" className="text-button" onClick={() => setRows(rows.filter((_, n) => n !== i))} aria-label={`Remove measurement ${i + 1}`}><Trash2 size={15} />Remove measurement</button></div><details className="measurement-reference"><summary>Laboratory reference and flag (optional)</summary><div className="form-grid"><Field label="Laboratory reference" hint="Copy the reporting laboratory's reference text."><input value={row.reference} maxLength={200} onChange={e => set(i, 'reference', e.target.value)} /></Field><Field label="Laboratory flag"><select value={row.flag} onChange={e => set(i, 'flag', e.target.value)}><option value="">No flag supplied</option><option value="high">High</option><option value="low">Low</option><option value="abnormal">Abnormal</option></select></Field></div></details></fieldset>;
  })}</div>}{<button className="text-button" type="button" disabled={rows.length >= 30} onClick={() => setRows([...rows, { name: '', result: '', unit: '', reference: '', flag: '' }])}><Plus size={15} />Add measurement</button>}</>;
}
export function ReportReadout({ report }: { report: any }) {
  return <>{report.measurements?.length ? <div className="measurement-results">{report.measurements.map((r: any, i: number) => <div key={i}><span><strong>{r.name}</strong>{r.reference && <small>Laboratory reference: {r.reference}</small>}</span><span className="measurement-result">{r.result} {r.unit === 'Not applicable' ? '' : r.unit}{r.flag && <small className="laboratory-flag">{r.flag}</small>}</span></div>)}</div> : <dl className="report-values"><div><dt>Recorded result</dt><dd>{report.value}</dd></div><div><dt>Unit</dt><dd>{report.unit}</dd></div></dl>}<dl className="report-values"><div><dt>Sample type</dt><dd>{report.specimen || 'Not recorded'}</dd></div><div><dt>Sample collected</dt><dd>{formatTime(report.collectedAt, true)}</dd></div><div><dt>Report approved</dt><dd>{formatTime(report.approvedAt, true)}</dd></div></dl>{report.reportComment && <p className="clinical-notes">{report.reportComment}</p>}{report.urgency === 'urgent' && <div className="urgent-handoff"><strong>Urgent clinician review</strong><p>Contacted {report.contact?.person} by {report.contact?.method} at {formatTime(report.contact?.at)}.</p></div>}</>;
}
