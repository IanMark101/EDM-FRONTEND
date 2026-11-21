'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
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
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const expanded = open && !disabled;
  const search = query.trim().toLocaleLowerCase();
  const filtered = QUANTITATIVE_LAB_UNITS.filter(unit =>
    !search || unit.toLocaleLowerCase().includes(search) || (UNIT_HINTS[unit] || '').toLocaleLowerCase().includes(search)
  );
  const activeIndex = filtered.length ? Math.min(active, filtered.length - 1) : -1;

  useEffect(() => {
    if (!expanded) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    searchInput.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (expanded && activeIndex >= 0) {
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [expanded, activeIndex, id]);

  function openMenu() {
    setQuery('');
    const idx = QUANTITATIVE_LAB_UNITS.indexOf(value as any);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function choose(unit: string) {
    onChange(unit);
    setOpen(false);
    setQuery('');
    trigger.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (!expanded) openMenu();
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!filtered.length) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1
        : Math.max(0, Math.min(filtered.length - 1, Math.max(0, activeIndex) + (event.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
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
        <div className="unit-picker-search">
          <Search size={14} aria-hidden="true" />
          <input ref={searchInput} type="text" value={query} placeholder="Filter unit (e.g. mg/dL, %, /hpf)…"
            onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={onSearchKeyDown} />
        </div>
        <ul id={`${id}-list`} className="unit-picker-options" role="listbox" aria-labelledby={`${id}-label`}>
          {filtered.length ? filtered.map((unit, index) => (
            <li key={unit} id={`${id}-option-${index}`} role="option" aria-selected={value === unit}
              className={activeIndex === index ? 'unit-picker-active' : undefined}
              onPointerMove={() => setActive(index)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(unit)}>
              <span><strong>{unit}</strong>{UNIT_HINTS[unit] && <small>{UNIT_HINTS[unit]}</small>}</span>
              {value === unit && <Check size={15} aria-hidden="true" />}
            </li>
          )) : <li className="unit-picker-empty" role="presentation">No standard UCUM unit matches “{query.trim()}”. Try mg/dL, g/dL, %, or /hpf.</li>}
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
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const expanded = open && !disabled;
  const search = query.trim().toLocaleLowerCase();
  const filtered = SPECIMEN_OPTIONS.filter(specimen =>
    !search || specimen.toLocaleLowerCase().includes(search) || (SPECIMEN_HINTS[specimen] || '').toLocaleLowerCase().includes(search)
  );
  const activeIndex = filtered.length ? Math.min(active, filtered.length - 1) : -1;

  useEffect(() => {
    if (!expanded) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    searchInput.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (expanded && activeIndex >= 0) {
      document.getElementById(`${id}-specimen-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [expanded, activeIndex, id]);

  function openMenu() {
    setQuery('');
    const idx = SPECIMEN_OPTIONS.indexOf(value as any);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function choose(specimen: string) {
    onChange(specimen);
    setOpen(false);
    setQuery('');
    trigger.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (!expanded) openMenu();
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!filtered.length) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1
        : Math.max(0, Math.min(filtered.length - 1, Math.max(0, activeIndex) + (event.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex]) choose(filtered[activeIndex]);
      else if (query.trim()) choose(query.trim());
    }
  }

  const customCandidate = query.trim();
  const hasExactMatch = SPECIMEN_OPTIONS.some(s => s.toLocaleLowerCase() === search);

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
        <div className="unit-picker-search">
          <Search size={14} aria-hidden="true" />
          <input ref={searchInput} type="text" value={query} placeholder="Filter or type sample (e.g. Blood, Serum, Urine)…"
            onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={onSearchKeyDown} />
        </div>
        <ul id={`${id}-list`} className="unit-picker-options" role="listbox" aria-labelledby={`${id}-label`}>
          {filtered.map((specimen, index) => (
            <li key={specimen} id={`${id}-specimen-${index}`} role="option" aria-selected={value === specimen}
              className={activeIndex === index ? 'unit-picker-active' : undefined}
              onPointerMove={() => setActive(index)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(specimen)}>
              <span><strong>{specimen}</strong>{SPECIMEN_HINTS[specimen] && <small>{SPECIMEN_HINTS[specimen]}</small>}</span>
              {value === specimen && <Check size={15} aria-hidden="true" />}
            </li>
          ))}
          {customCandidate && !hasExactMatch && (
            <li role="option" aria-selected={value === customCandidate}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(customCandidate)}>
              <span><strong>Use “{customCandidate}”</strong><small>Custom sample type</small></span>
            </li>
          )}
          {value && !search && (
            <li role="option" aria-selected={false}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose('')}>
              <span><small>Clear sample type</small></span>
            </li>
          )}
        </ul>
      </div>}
    </div>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
  </div>;
}
