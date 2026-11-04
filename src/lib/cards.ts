import cardsJson from '../data/cards.json';
import setsJson from '../data/sets.json';
import type { Card, CardSet, CardType, Domain, Rarity } from '../types/card';

export const ALL_CARDS = cardsJson as Card[];
export const SETS = (setsJson as { syncedAt: string; sets: CardSet[] }).sets;
export const SYNCED_AT = (setsJson as { syncedAt: string }).syncedAt;

export const CARDS_BY_ID = new Map<string, Card>(ALL_CARDS.map((c) => [c.id, c]));

/** All printings of a card, keyed by baseKey. The first entry is the "canonical" printing. */
export const PRINTINGS = new Map<string, Card[]>();
for (const c of ALL_CARDS) {
  const list = PRINTINGS.get(c.baseKey);
  if (list) list.push(c);
  else PRINTINGS.set(c.baseKey, [c]);
}
for (const list of PRINTINGS.values()) list.sort((a, b) => Number(a.isAltArt) - Number(b.isAltArt));

/** One canonical printing per distinct card (no alt arts / reprints). */
export const UNIQUE_CARDS: Card[] = [...PRINTINGS.values()].map((l) => l[0]);

/** Names of every champion, taken from champion units. Used to read a legend's champion tag. */
const CHAMPION_NAMES = new Set(
  ALL_CARDS.filter((c) => c.supertypes.includes('champion')).map((c) => c.name),
);

/**
 * The champion a Legend represents. Legend tags can include extra tags such as
 * "Yordle" or "Shurima", so pick the one that names a champion.
 */
export function legendChampion(legend: Card): string | null {
  return legend.tags.find((t) => CHAMPION_NAMES.has(t)) ?? legend.tags[legend.tags.length - 1] ?? null;
}

export const displayName = (c: Pick<Card, 'name' | 'subtitle'>) =>
  c.subtitle ? `${c.name}, ${c.subtitle}` : c.name;

export const isToken = (c: Card) => c.supertypes.includes('token');

export interface CardFilters {
  query: string;
  sets: string[];
  domains: Domain[];
  types: CardType[];
  rarities: Rarity[];
  energyMin: number | null;
  energyMax: number | null;
  owned: 'all' | 'owned' | 'missing';
  showVariants: boolean;
}

export const EMPTY_FILTERS: CardFilters = {
  query: '',
  sets: [],
  domains: [],
  types: [],
  rarities: [],
  energyMin: null,
  energyMax: null,
  owned: 'all',
  showVariants: false,
};

export type SortKey = 'set' | 'name' | 'energy' | 'price-desc' | 'price-asc';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

const searchIndex = new Map<string, string>(
  ALL_CARDS.map((c) => [c.id, norm([c.name, c.subtitle, c.text, c.effect, c.tags.join(' '), c.code].join(' '))]),
);

/** Filter + sort a card list. `ownedQty` returns how many copies of a printing the user owns. */
export function filterCards(
  cards: Card[],
  f: CardFilters,
  sort: SortKey,
  ownedQty?: (id: string) => number,
  priceOf?: (id: string) => number | null,
): Card[] {
  const terms = norm(f.query).split(/\s+/).filter(Boolean);
  const out = cards.filter((c) => {
    if (!f.showVariants && c.isAltArt) return false;
    if (f.sets.length && !f.sets.includes(c.set ?? '')) return false;
    if (f.types.length && !f.types.includes(c.type as CardType)) return false;
    if (f.rarities.length && !f.rarities.includes(c.rarity as Rarity)) return false;
    if (f.domains.length && !c.domains.some((d) => f.domains.includes(d))) return false;
    if (f.energyMin != null && (c.energy ?? -1) < f.energyMin) return false;
    if (f.energyMax != null && (c.energy ?? Infinity) > f.energyMax) return false;
    if (ownedQty && f.owned !== 'all') {
      const has = ownedQty(c.id) > 0;
      if (f.owned === 'owned' ? !has : has) return false;
    }
    if (terms.length) {
      const hay = searchIndex.get(c.id) ?? '';
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  if (sort === 'name') out.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  else if (sort === 'energy')
    out.sort((a, b) => (a.energy ?? 99) - (b.energy ?? 99) || displayName(a).localeCompare(displayName(b)));
  else if ((sort === 'price-desc' || sort === 'price-asc') && priceOf) {
    // Unpriced cards always go last.
    const dir = sort === 'price-desc' ? -1 : 1;
    const p = new Map(out.map((c) => [c.id, priceOf(c.id)]));
    out.sort((a, b) => {
      const pa = p.get(a.id) ?? null;
      const pb = p.get(b.id) ?? null;
      if (pa == null || pb == null) return pa == null ? (pb == null ? 0 : 1) : -1;
      return (pa - pb) * dir;
    });
  }
  // 'set' keeps the order from cards.json (set, then collector number).
  return out;
}
