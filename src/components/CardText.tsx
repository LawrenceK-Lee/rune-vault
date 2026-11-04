import { Fragment } from 'react';
import type { Domain } from '../types/card';
import { DOMAIN_COLORS } from '../lib/ui';

/** Renders Riftbound rules text, turning :rb_…: tokens and [Keywords] into inline symbols. */
export function CardText({ text }: { text: string }) {
  const parts = text.split(/(:rb_[a-z0-9_]+:|\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        const energy = p.match(/^:rb_energy_(\d+):$/);
        if (energy)
          return (
            <span key={i} title={`${energy[1]} energy`} className="mx-px inline-flex h-[1.15em] min-w-[1.15em] items-center justify-center rounded-full bg-slate-200 px-0.5 align-[-0.15em] text-[0.75em] font-bold text-ink-950">
              {energy[1]}
            </span>
          );
        const rune = p.match(/^:rb_rune_([a-z]+):$/);
        if (rune) {
          const d = rune[1];
          const bg = d === 'rainbow' ? 'conic-gradient(#d9483b,#e38b2c,#e6c76b,#3fae7a,#3f7fd9,#9b5bd6,#d9483b)' : DOMAIN_COLORS[d as Domain] ?? '#888';
          return <span key={i} title={d === 'rainbow' ? 'Any rune' : `${d} rune`} className="mx-px inline-block h-[0.9em] w-[0.9em] rotate-45 rounded-[2px] align-[-0.05em] ring-1 ring-black/40" style={{ background: bg }} />;
        }
        if (p === ':rb_might:') return <span key={i} title="Might" className="text-gold-300">⚔</span>;
        if (p === ':rb_exhaust:') return <span key={i} title="Exhaust" className="text-slate-300">⟳</span>;
        if (/^\[[^\]]+\]$/.test(p)) return <b key={i} className="font-semibold text-gold-300">{p.slice(1, -1)}</b>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
