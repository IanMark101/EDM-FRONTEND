'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function TestPicker({ tests, value, onChange, disabled = false }: {
  tests: string[]; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, tests.length - 1));
  const expanded = open && !disabled;
  useEffect(() => {
    if (!expanded) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [expanded]);
  useEffect(() => {
    if (expanded) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [expanded, activeIndex, id]);
  function show(index = Math.max(0, tests.indexOf(value))) { setActive(index); setOpen(true); }
  function choose(index: number) { if (!tests[index]) return; onChange(tests[index]); setOpen(false); trigger.current?.focus(); }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') {
      if (expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (expanded) choose(activeIndex); else show(); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tests.length - 1
        : !expanded ? Math.max(0, tests.indexOf(value)) : Math.max(0, Math.min(tests.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
      show(next); return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const text = (Date.now() - search.current.at < 700 ? search.current.text : '') + event.key.toLocaleLowerCase();
      search.current = { text, at: Date.now() };
      const index = tests.findIndex(test => test.toLocaleLowerCase().startsWith(text));
      if (index >= 0) { event.preventDefault(); show(index); }
    }
  }
  return <div className="field">
    <span id={`${id}-label`}>Laboratory test</span>
    <div className="test-picker" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
      <button ref={trigger} type="button" className="test-picker-trigger" role="combobox" aria-labelledby={`${id}-label`}
        aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined}
        aria-activedescendant={expanded ? `${id}-option-${activeIndex}` : undefined} aria-required="true" disabled={disabled}
        onClick={() => expanded ? setOpen(false) : show()} onKeyDown={keyDown}>
        <span className={value ? undefined : 'muted'}>{value || 'Choose a test'}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {expanded && <ul id={`${id}-list`} className="test-picker-options" role="listbox" aria-labelledby={`${id}-label`}>
        {tests.map((test, index) => <li key={test} id={`${id}-option-${index}`} role="option" aria-selected={value === test}
          className={activeIndex === index ? 'test-picker-active' : undefined} onPointerMove={() => setActive(index)}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <span>{test}</span>{value === test && <Check size={16} aria-hidden="true" />}
        </li>)}
      </ul>}
    </div>
  </div>;
}
