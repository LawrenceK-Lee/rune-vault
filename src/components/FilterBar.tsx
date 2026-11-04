import { CARD_TYPES, DOMAINS, RARITIES, type CardType, type Domain, type Rarity } from '../types/card';
import { EMPTY_FILTERS, SETS, type CardFilters, type SortKey } from '../lib/cards';
import { DomainDot } from './bits';

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

const STRIP = '-mx-4 flex items-center gap-x-5 gap-y-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </div>
  );
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
  const set = (patch: Partial<CardFilters>) => onChange({ ...filters, ...patch });
  const activeDomains = filters.domains.filter((d) => domainOptions.includes(d));
  const active =
    filters.sets.length + activeDomains.length + filters.types.length + filters.rarities.length +
    (filters.energyMin != null ? 1 : 0) + (filters.energyMax != null ? 1 : 0) + (filters.owned !== 'all' ? 1 : 0);

  return (
    <div className="shrink-0 space-y-2">
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
        {(active > 0 || filters.query) && (
          <button type="button" className="btn-ghost" onClick={() => onChange({ ...EMPTY_FILTERS, showVariants: filters.showVariants })}>
            Clear{active ? ` (${active})` : ''}
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

      {/* All filters stay visible. On phones each row scrolls sideways so the card grid keeps its room. */}
      <div className={STRIP}>
        {!hide.includes('types') && (
          <Group label="Type">
            {CARD_TYPES.map((t: CardType) => (
              <button key={t} type="button" className={filters.types.includes(t) ? 'chip-on' : 'chip-off'} onClick={() => set({ types: toggle(filters.types, t) })}>
                {t}
              </button>
            ))}
          </Group>
        )}
        <Group label="Rarity">
          {RARITIES.map((r: Rarity) => (
            <button key={r} type="button" className={filters.rarities.includes(r) ? 'chip-on' : 'chip-off'} onClick={() => set({ rarities: toggle(filters.rarities, r) })}>
              {r}
            </button>
          ))}
        </Group>
      </div>
      <div className={STRIP}>
        <Group label="Set">
          {SETS.map((s) => (
            <button key={s.id} type="button" className={filters.sets.includes(s.id) ? 'chip-on' : 'chip-off'} onClick={() => set({ sets: toggle(filters.sets, s.id) })} title={s.id}>
              {s.name}
            </button>
          ))}
        </Group>
        <Group label="Energy">
          <input type="number" min={0} max={12} placeholder="min" aria-label="Minimum energy" className="w-16 !px-2 !py-1 !text-xs" value={filters.energyMin ?? ''} onChange={(e) => set({ energyMin: e.target.value === '' ? null : Number(e.target.value) })} />
          <span className="text-slate-500">–</span>
          <input type="number" min={0} max={12} placeholder="max" aria-label="Maximum energy" className="w-16 !px-2 !py-1 !text-xs" value={filters.energyMax ?? ''} onChange={(e) => set({ energyMax: e.target.value === '' ? null : Number(e.target.value) })} />
        </Group>
        {showOwned && (
          <Group label="Owned">
            {(['all', 'owned', 'missing'] as const).map((o) => (
              <button key={o} type="button" className={filters.owned === o ? 'chip-on' : 'chip-off'} onClick={() => set({ owned: o })}>
                {o === 'all' ? 'All' : o === 'owned' ? 'Owned' : 'Not owned'}
              </button>
            ))}
          </Group>
        )}
        {!hide.includes('variants') && (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-slate-300" title="Show alt arts, signed and promo printings">
            <input type="checkbox" checked={filters.showVariants} onChange={(e) => set({ showVariants: e.target.checked })} />
            Alt arts &amp; promos
          </label>
        )}
      </div>
    </div>
  );
}
