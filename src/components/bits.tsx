import type { Card, Domain } from '../types/card';
import { DOMAIN_COLORS, RARITY_COLORS, cap } from '../lib/ui';

export function DomainDot({ domain, size = 10 }: { domain: Domain; size?: number }) {
  return (
    <span
      title={cap(domain)}
      className="inline-block shrink-0 rounded-full ring-1 ring-black/40"
      style={{ width: size, height: size, background: DOMAIN_COLORS[domain] }}
    />
  );
}

export function DomainDots({ domains, size }: { domains: Domain[]; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {domains.map((d) => (
        <DomainDot key={d} domain={d} size={size} />
      ))}
    </span>
  );
}

export function RarityGem({ rarity }: { rarity: Card['rarity'] }) {
  if (!rarity) return null;
  return (
    <span
      title={cap(rarity)}
      className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px]"
      style={{ background: RARITY_COLORS[rarity] }}
    />
  );
}

export function QuantityStepper({
  value,
  onChange,
  max,
  size = 'md',
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const btn =
    size === 'sm'
      ? 'h-7 w-7 text-base'
      : 'h-9 w-9 text-lg';
  return (
    <div className="inline-flex items-center rounded-lg border border-ink-600 bg-ink-900/90" aria-label={label}>
      <button
        type="button"
        className={`${btn} rounded-l-lg text-slate-300 hover:bg-ink-700 disabled:opacity-30`}
        onClick={(e) => {
          e.stopPropagation();
          onChange(value - 1);
        }}
        disabled={value <= 0}
        aria-label="Remove one"
      >
        −
      </button>
      <span className={`min-w-[2ch] text-center font-semibold tabular-nums ${size === 'sm' ? 'text-sm' : ''} ${value ? 'text-gold-300' : 'text-slate-500'}`}>
        {value}
      </span>
      <button
        type="button"
        className={`${btn} rounded-r-lg text-slate-300 hover:bg-ink-700 disabled:opacity-30`}
        onClick={(e) => {
          e.stopPropagation();
          onChange(value + 1);
        }}
        disabled={max != null && value >= max}
        aria-label="Add one"
      >
        +
      </button>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-600 border-t-gold-400" />
      {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  return <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">{msg}</div>;
}
