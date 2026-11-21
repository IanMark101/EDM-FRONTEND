'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { QUANTITATIVE_LAB_UNITS, SPECIMEN_OPTIONS } from '@shared/clinical';

const SPECIMEN_HINTS: Record<string, string> = {
  'Blood': 'Venous or capillary blood sample',
  'Urine': 'Clean-catch or random urine (urinalysis)',
  'Serum': 'Separated blood serum (glucose, lipids, renal)',
  'Plasma': 'Anticoagulated blood plasma',
  'Whole blood': 'EDTA whole blood (CBC, Hemoglobin A1c)',
  'Stool': 'Fecal specimen',
  'Swab': 'Throat, nasal or wound swab',
  'Sputum': 'Respiratory sputum specimen',
};

const UNIT_HINTS: Record<string, string> = {
  'mg/dL': 'Glucose, creatinine, lipid',
  'mmol/L': 'SI glucose, electrolytes',
  'g/dL': 'Hemoglobin',
  'g/L': 'Protein, albumin',
  '%': 'Hematocrit, HbA1c',
  '10^9/L': 'WBC, platelets',
  '10^12/L': 'Red blood cells',
  '/uL': 'Cells per microliter',
  '/hpf': 'Per high-power field',
  '/lpf': 'Per low-power field',
  'U/L': 'Liver enzymes (ALT/AST)',
  'mEq/L': 'Electrolytes (Na, K, Cl)',
  'mIU/L': 'Thyroid (TSH)',
  'ng/mL': 'Hormones, vitamin D',
  'pg/mL': 'Vitamin B12, free T3/T4',
  'IU/mL': 'Serology titers',
  'mm/hr': 'ESR',
  'mL/min/1.73m²': 'eGFR',
  'seconds': 'Clotting time (PT/aPTT)',
  'INR': 'Coagulation ratio',
};

export function UnitPicker({ label = 'Unit', value, onChange, disabled = false, error, align = 'right' }: {
  label?: string; value: string; onChange: (value: string) => void; disabled?: boolean; error?: string; align?: 'right' | 'left';
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const expanded = open && !disabled;
  const activeIndex = Math.min(active, QUANTITATIVE_LAB_UNITS.length - 1);

  useEffect(() => {
    if (!expanded) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [expanded]);

  useEffect(() => {
    if (expanded && activeIndex >= 0) {
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [expanded, activeIndex, id]);

  function openMenu() {
    const idx = QUANTITATIVE_LAB_UNITS.indexOf(value as any);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function choose(unit: string) {
    onChange(unit);
    setOpen(false);
    trigger.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (expanded && QUANTITATIVE_LAB_UNITS[activeIndex]) choose(QUANTITATIVE_LAB_UNITS[activeIndex]);
      else openMenu();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!expanded) { openMenu(); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? QUANTITATIVE_LAB_UNITS.length - 1
        : Math.max(0, Math.min(QUANTITATIVE_LAB_UNITS.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
    }
  }

  const displayText = disabled && value === 'Not applicable' ? 'Not applicable' : value || 'Choose unit';

  return <div className={`field ${error ? 'field-invalid' : ''}`}>
    <span id={`${id}-label`}>{label}</span>
    <div className={`unit-picker ${align === 'left' ? 'unit-picker-left' : ''}`} ref={root}>
      <button ref={trigger} type="button" className="unit-picker-trigger" role="combobox"
        aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={expanded}
        aria-controls={expanded ? `${id}-list` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled} onClick={() => expanded ? setOpen(false) : openMenu()} onKeyDown={onTriggerKeyDown}>
        <span className={value ? undefined : 'muted'}>{displayText}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {expanded && <div className="unit-picker-popover">
        <ul id={`${id}-list`} className="unit-picker-options" role="listbox" aria-labelledby={`${id}-label`}>
          {QUANTITATIVE_LAB_UNITS.map((unit, index) => (
            <li key={unit} id={`${id}-option-${index}`} role="option" aria-selected={value === unit}
              className={activeIndex === index ? 'unit-picker-active' : undefined}
              onPointerMove={() => setActive(index)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(unit)}>
              <span><strong>{unit}</strong>{UNIT_HINTS[unit] && <small>{UNIT_HINTS[unit]}</small>}</span>
              {value === unit && <Check size={15} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </div>}
    </div>
    {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
  </div>;
}

export function SpecimenPicker({ label = 'Sample type', hint = 'For example: Blood, Serum or Urine.', value, onChange, disabled = false, error }: {
  label?: string; hint?: string; value: string; onChange: (value: string) => void; disabled?: boolean; error?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const expanded = open && !disabled;
  const activeIndex = Math.min(active, SPECIMEN_OPTIONS.length - 1);

  useEffect(() => {
    if (!expanded) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [expanded]);

  useEffect(() => {
    if (expanded && activeIndex >= 0) {
      document.getElementById(`${id}-specimen-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [expanded, activeIndex, id]);

  function openMenu() {
    const idx = SPECIMEN_OPTIONS.findIndex(s => s.toLocaleLowerCase() === (value || '').toLocaleLowerCase());
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function choose(specimen: string) {
    onChange(specimen);
    setOpen(false);
    trigger.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (expanded && SPECIMEN_OPTIONS[activeIndex]) choose(SPECIMEN_OPTIONS[activeIndex]);
      else openMenu();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!expanded) { openMenu(); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? SPECIMEN_OPTIONS.length - 1
        : Math.max(0, Math.min(SPECIMEN_OPTIONS.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
    }
  }

  return <div className={`field ${error ? 'field-invalid' : ''}`}>
    <span id={`${id}-label`}>{label}</span>
    <div className="unit-picker unit-picker-left" ref={root}>
      <button ref={trigger} type="button" className="unit-picker-trigger" role="combobox"
        aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={expanded}
        aria-controls={expanded ? `${id}-list` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        disabled={disabled} onClick={() => expanded ? setOpen(false) : openMenu()} onKeyDown={onTriggerKeyDown}>
        <span className={value ? undefined : 'muted'}>{value || 'Choose sample type'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {expanded && <div className="unit-picker-popover">
        <ul id={`${id}-list`} className="unit-picker-options" role="listbox" aria-labelledby={`${id}-label`}>
          {SPECIMEN_OPTIONS.map((specimen, index) => (
            <li key={specimen} id={`${id}-specimen-${index}`} role="option" aria-selected={value.toLocaleLowerCase() === specimen.toLocaleLowerCase()}
              className={activeIndex === index ? 'unit-picker-active' : undefined}
              onPointerMove={() => setActive(index)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(specimen)}>
              <span><strong>{specimen}</strong>{SPECIMEN_HINTS[specimen] && <small>{SPECIMEN_HINTS[specimen]}</small>}</span>
              {value.toLocaleLowerCase() === specimen.toLocaleLowerCase() && <Check size={15} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </div>}
    </div>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
  </div>;
}
