import { useEffect, useState } from 'react';
import { CARD_TYPES, DOMAINS, RARITIES, type CardType, type Domain, type Rarity } from '../types/card';
import { EMPTY_FILTERS, SETS, type CardFilters, type SortKey } from '../lib/cards';
import { DomainDot } from './bits';

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

const label = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500';

/** Desktop: a labelled group of chips that stays on one line and wraps as a unit. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`mr-0.5 ${label}`}>{title}</span>
      {children}
    </div>
  );
}

/** Phones: a panel that slides up from the bottom with one filter's options. */
function Sheet({ title, onClose, onClear, children }: { title: string; onClose: () => void; onClear?: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${title} filter`}>
      <div
        className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl border-t border-ink-600 bg-ink-900 px-4 pt-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          {onClear && (
            <button type="button" className="text-sm text-slate-400 underline" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
        {children}
        <button type="button" className="btn-primary mt-4 w-full" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

type SheetKey = 'domain' | 'type' | 'rarity' | 'set' | 'more';

export function FilterBar({
  filters,
  onChange,
  sort,
  onSort,
  showOwned,
  hide = [],
  resultCount,
  searchRef,
  onSearchEnter,
  pricesAvailable = false,
  domainOptions = DOMAINS,
}: {
  pricesAvailable?: boolean;
  /** Which domain chips to offer (e.g. only the Legend's domains in the deck editor). */
  domainOptions?: Domain[];
  filters: CardFilters;
  onChange: (f: CardFilters) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  showOwned: boolean;
  hide?: ('types' | 'domains' | 'variants')[];
  resultCount: number;
  searchRef?: React.Ref<HTMLInputElement>;
  onSearchEnter?: () => void;
}) {
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const set = (patch: Partial<CardFilters>) => onChange({ ...filters, ...patch });
  const activeDomains = filters.domains.filter((d) => domainOptions.includes(d));
  const energyCount = (filters.energyMin != null ? 1 : 0) + (filters.energyMax != null ? 1 : 0);
  const moreCount = energyCount + (filters.owned !== 'all' ? 1 : 0);
  const active = filters.sets.length + activeDomains.length + filters.types.length + filters.rarities.length + moreCount;
  const clearAll = () => onChange({ ...EMPTY_FILTERS, showVariants: filters.showVariants });

  // ---- option lists, shared by the desktop rows and the phone sheets
  const chip = (on: boolean) => (on ? 'chip-on' : 'chip-off');
  const domainChips = domainOptions.map((d: Domain) => (
    <button key={d} type="button" className={chip(activeDomains.includes(d))} onClick={() => set({ domains: toggle(activeDomains, d) })}>
      <DomainDot domain={d} /> {d}
    </button>
  ));
  const typeChips = CARD_TYPES.map((t: CardType) => (
    <button key={t} type="button" className={chip(filters.types.includes(t))} onClick={() => set({ types: toggle(filters.types, t) })}>
      {t}
    </button>
  ));
  const rarityChips = RARITIES.map((r: Rarity) => (
    <button key={r} type="button" className={chip(filters.rarities.includes(r))} onClick={() => set({ rarities: toggle(filters.rarities, r) })}>
      {r}
    </button>
  ));
  const setChips = SETS.map((s) => (
    <button key={s.id} type="button" className={chip(filters.sets.includes(s.id))} onClick={() => set({ sets: toggle(filters.sets, s.id) })} title={s.id}>
      {s.name}
    </button>
  ));
  const energyInputs = (
    <>
      <input type="number" inputMode="numeric" min={0} max={12} placeholder="min" aria-label="Minimum energy" className="w-16 !px-2 !py-1 !text-xs" value={filters.energyMin ?? ''} onChange={(e) => set({ energyMin: e.target.value === '' ? null : Number(e.target.value) })} />
      <span className="text-slate-500">–</span>
      <input type="number" inputMode="numeric" min={0} max={12} placeholder="max" aria-label="Maximum energy" className="w-16 !px-2 !py-1 !text-xs" value={filters.energyMax ?? ''} onChange={(e) => set({ energyMax: e.target.value === '' ? null : Number(e.target.value) })} />
    </>
  );
  const ownedChips = (['all', 'owned', 'missing'] as const).map((o) => (
    <button key={o} type="button" className={chip(filters.owned === o)} onClick={() => set({ owned: o })}>
      {o === 'all' ? 'All' : o === 'owned' ? 'Owned' : 'Not owned'}
    </button>
  ));
  const variantsToggle = (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300" title="Show alt arts, signed and promo printings">
      <input type="checkbox" checked={filters.showVariants} onChange={(e) => set({ showVariants: e.target.checked })} />
      Alt arts &amp; promos
    </label>
  );

  // ---- phone: one compact row of filter buttons
  const pills: { key: SheetKey; title: string; count: number; show: boolean }[] = [
    { key: 'domain', title: 'Domain', count: activeDomains.length, show: !hide.includes('domains') },
    { key: 'type', title: 'Type', count: filters.types.length, show: !hide.includes('types') },
    { key: 'rarity', title: 'Rarity', count: filters.rarities.length, show: true },
    { key: 'set', title: 'Set', count: filters.sets.length, show: true },
    { key: 'more', title: 'More', count: moreCount, show: true },
  ];
  const close = () => setSheet(null);

  return (
    <div className="min-w-0 shrink-0 space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={searchRef}
          type="search"
          placeholder="Search cards, text or codes…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearchEnter) {
              e.preventDefault();
              onSearchEnter();
            }
          }}
          className="min-w-0 flex-1"
        />
        <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="Sort by" className="w-32 shrink-0 sm:w-auto">
          <option value="set">Sort: Set #</option>
          <option value="name">Sort: Name</option>
          <option value="energy">Sort: Energy</option>
          {pricesAvailable && <option value="price-desc">Sort: Price (high → low)</option>}
          {pricesAvailable && <option value="price-asc">Sort: Price (low → high)</option>}
        </select>
        {(active > 0 || filters.query) && (
          <button type="button" className="btn-ghost hidden shrink-0 sm:inline-flex" onClick={clearAll}>
            Clear{active ? ` (${active})` : ''}
          </button>
        )}
        <span className="hidden shrink-0 whitespace-nowrap text-sm tabular-nums text-slate-400 sm:inline">{resultCount.toLocaleString()} cards</span>
      </div>

      {/* Phones: compact buttons that open a sheet; they wrap instead of scrolling sideways. */}
      <div className="flex flex-wrap items-center gap-1 sm:hidden">
        {pills
          .filter((p) => p.show)
          .map((p) => (
            <button key={p.key} type="button" className={`${chip(p.count > 0)} !gap-0.5 !px-2`} onClick={() => setSheet(p.key)} aria-haspopup="dialog">
              {p.title}
              {p.count > 0 && <span className="rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-ink-950">{p.count}</span>}
              <svg viewBox="0 0 20 20" className="h-3 w-3 opacity-70" fill="currentColor" aria-hidden="true">
                <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
              </svg>
            </button>
          ))}
        {/* Only when narrowed down, to save a line on small screens. */}
        {(active > 0 || filters.query) && (
          <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-slate-400">
            {resultCount.toLocaleString()} cards
            <button type="button" className="text-gold-300 underline" onClick={clearAll}>
              Clear
            </button>
          </span>
        )}
      </div>

      {/* Larger screens: every option visible, wrapping onto extra lines as needed. */}
      <div className="hidden space-y-2 sm:block">
        {!hide.includes('domains') && <div className="flex flex-wrap gap-1.5">{domainChips}</div>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {!hide.includes('types') && <Group title="Type">{typeChips}</Group>}
          <Group title="Rarity">{rarityChips}</Group>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Group title="Set">{setChips}</Group>
          <Group title="Energy">{energyInputs}</Group>
          {showOwned && <Group title="Owned">{ownedChips}</Group>}
          {!hide.includes('variants') && variantsToggle}
        </div>
      </div>

      {sheet === 'domain' && (
        <Sheet title="Domain" onClose={close} onClear={() => set({ domains: [] })}>
          <div className="flex flex-wrap gap-2">{domainChips}</div>
        </Sheet>
      )}
      {sheet === 'type' && (
        <Sheet title="Type" onClose={close} onClear={() => set({ types: [] })}>
          <div className="flex flex-wrap gap-2">{typeChips}</div>
        </Sheet>
      )}
      {sheet === 'rarity' && (
        <Sheet title="Rarity" onClose={close} onClear={() => set({ rarities: [] })}>
          <div className="flex flex-wrap gap-2">{rarityChips}</div>
        </Sheet>
      )}
      {sheet === 'set' && (
        <Sheet title="Set" onClose={close} onClear={() => set({ sets: [] })}>
          <div className="flex flex-wrap gap-2">{setChips}</div>
        </Sheet>
      )}
      {sheet === 'more' && (
        <Sheet title="More filters" onClose={close} onClear={() => set({ energyMin: null, energyMax: null, owned: 'all' })}>
          <div className="space-y-4">
            <div>
              <div className={`mb-2 ${label}`}>Energy cost</div>
              <div className="flex items-center gap-2">{energyInputs}</div>
            </div>
            {showOwned && (
              <div>
                <div className={`mb-2 ${label}`}>Owned</div>
                <div className="flex flex-wrap gap-2">{ownedChips}</div>
              </div>
            )}
            {!hide.includes('variants') && variantsToggle}
          </div>
        </Sheet>
      )}
    </div>
  );
}
