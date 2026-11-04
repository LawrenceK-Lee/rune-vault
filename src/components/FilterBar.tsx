import { useState } from 'react';
import { CARD_TYPES, DOMAINS, RARITIES, type CardType, type Domain, type Rarity } from '../types/card';
import { EMPTY_FILTERS, SETS, type CardFilters, type SortKey } from '../lib/cards';
import { DomainDot } from './bits';

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

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
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<CardFilters>) => onChange({ ...filters, ...patch });
  const activeDomains = filters.domains.filter((d) => domainOptions.includes(d));
  const active =
    filters.sets.length + activeDomains.length + filters.types.length + filters.rarities.length +
    (filters.energyMin != null ? 1 : 0) + (filters.energyMax != null ? 1 : 0) + (filters.owned !== 'all' ? 1 : 0);

  return (
    <div className="shrink-0 space-y-2 sm:space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={searchRef}
          type="search"
          placeholder="Search name, text, tag or code…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearchEnter) {
              e.preventDefault();
              onSearchEnter();
            }
          }}
          className="min-w-0 flex-1 basis-full sm:basis-60"
        />
        {/* On phones these sit together on one line under the search box. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="Sort by" className="min-w-0 max-w-[11rem] sm:max-w-none">
          <option value="set">Sort: Set #</option>
          <option value="name">Sort: Name</option>
          <option value="energy">Sort: Energy</option>
          {pricesAvailable && <option value="price-desc">Sort: Price (high → low)</option>}
          {pricesAvailable && <option value="price-asc">Sort: Price (low → high)</option>}
        </select>
        <button type="button" className={active ? 'btn-primary' : 'btn-ghost'} onClick={() => setOpen((o) => !o)}>
          Filters{active ? ` (${active})` : ''}
        </button>
        {(active > 0 || filters.query) && (
          <button type="button" className="btn-ghost" onClick={() => onChange({ ...EMPTY_FILTERS, showVariants: filters.showVariants })}>
            Clear
          </button>
        )}
        <span className="ml-auto whitespace-nowrap text-sm text-slate-400 tabular-nums">{resultCount.toLocaleString()} cards</span>
        </div>
      </div>

      {!hide.includes('domains') && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {domainOptions.map((d: Domain) => (
            <button key={d} type="button" className={`shrink-0 ${activeDomains.includes(d) ? 'chip-on' : 'chip-off'}`} onClick={() => set({ domains: toggle(activeDomains, d) })}>
              <DomainDot domain={d} /> {d}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="panel grid max-h-[45vh] gap-4 overflow-y-auto p-4 sm:max-h-none sm:grid-cols-2 lg:grid-cols-4">
          {!hide.includes('types') && (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Type</legend>
              <div className="flex flex-wrap gap-1.5">
                {CARD_TYPES.map((t: CardType) => (
                  <button key={t} type="button" className={filters.types.includes(t) ? 'chip-on' : 'chip-off'} onClick={() => set({ types: toggle(filters.types, t) })}>
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Rarity</legend>
            <div className="flex flex-wrap gap-1.5">
              {RARITIES.map((r: Rarity) => (
                <button key={r} type="button" className={filters.rarities.includes(r) ? 'chip-on' : 'chip-off'} onClick={() => set({ rarities: toggle(filters.rarities, r) })}>
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Set</legend>
            <div className="flex flex-wrap gap-1.5">
              {SETS.map((s) => (
                <button key={s.id} type="button" className={filters.sets.includes(s.id) ? 'chip-on' : 'chip-off'} onClick={() => set({ sets: toggle(filters.sets, s.id) })} title={s.id}>
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <div>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Energy cost</legend>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={12} placeholder="min" className="w-20" value={filters.energyMin ?? ''} onChange={(e) => set({ energyMin: e.target.value === '' ? null : Number(e.target.value) })} />
                <span className="text-slate-500">–</span>
                <input type="number" min={0} max={12} placeholder="max" className="w-20" value={filters.energyMax ?? ''} onChange={(e) => set({ energyMax: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
            {showOwned && (
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'owned', 'missing'] as const).map((o) => (
                  <button key={o} type="button" className={filters.owned === o ? 'chip-on' : 'chip-off'} onClick={() => set({ owned: o })}>
                    {o === 'all' ? 'Owned & not' : o === 'owned' ? 'Owned' : 'Not owned'}
                  </button>
                ))}
              </div>
            )}
            {!hide.includes('variants') && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={filters.showVariants} onChange={(e) => set({ showVariants: e.target.checked })} />
                Show alt arts, signed &amp; promo printings
              </label>
            )}
          </fieldset>
        </div>
      )}
    </div>
  );
}
