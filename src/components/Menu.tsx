import { useEffect, useId, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}

/** A button that opens a small dropdown list of actions. Sections are separated by a divider. */
export function Menu({ label, sections, className = 'btn-ghost', align = 'right' }: { label: React.ReactNode; sections: { title?: string; items: MenuItem[] }[]; className?: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" className={className} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {label}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      {open && (
        <div id={id} role="menu" className={`absolute z-40 mt-1 w-72 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 py-1 shadow-2xl shadow-black/50 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {sections.map((s, i) => (
            <div key={i} className={i ? 'mt-1 border-t border-ink-700 pt-1' : ''}>
              {s.title && <div className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.title}</div>}
              {s.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-ink-700 focus:bg-ink-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="block text-sm text-slate-100">{item.label}</span>
                  {item.hint && <span className="block text-xs text-slate-400">{item.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
