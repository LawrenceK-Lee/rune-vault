import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARDS_BY_ID, UNIQUE_CARDS, legendChampion } from './cards';
import { maxQuantity, missingCards, validateDeck, type DeckEntry, type DeckInput } from './deckRules';
import type { Card } from '../types/card';

// Build a legal deck from the real card data: Jinx (Fury / Chaos).
const legend = UNIQUE_CARDS.find((c) => c.type === 'legend' && legendChampion(c) === 'Jinx')!;
const champion = UNIQUE_CARDS.find(
  (c) => c.type === 'unit' && c.supertypes.includes('champion') && c.tags.includes('Jinx'),
)!;
const inDomains = (c: Card) => c.domains.every((d) => d === 'colorless' || legend.domains.includes(d));
const fillers = UNIQUE_CARDS.filter(
  (c) =>
    (c.type === 'unit' || c.type === 'spell' || c.type === 'gear') &&
    c.supertypes.length === 0 &&
    inDomains(c),
).slice(0, 13); // 13 × 3 = 39, + Chosen Champion = 40
const runes = UNIQUE_CARDS.filter((c) => c.type === 'rune' && legend.domains.includes(c.domains[0]));
const battlefields = UNIQUE_CARDS.filter((c) => c.type === 'battlefield' && !c.supertypes.includes('token')).slice(0, 3);

function legalDeck(): DeckInput {
  const entries: DeckEntry[] = [
    ...fillers.map((c) => ({ cardId: c.id, zone: 'main' as const, quantity: 3 })),
    { cardId: runes[0].id, zone: 'rune', quantity: 6 },
    { cardId: runes[1].id, zone: 'rune', quantity: 6 },
    ...battlefields.map((c) => ({ cardId: c.id, zone: 'battlefield' as const, quantity: 1 })),
  ];
  return { legendId: legend.id, championId: champion.id, entries };
}

const errors = (d: DeckInput, tournament = false) =>
  validateDeck(d, CARDS_BY_ID, { tournament }).issues.filter((i) => i.level === 'error').map((i) => i.message);

describe('test fixtures', () => {
  it('found real cards to build with', () => {
    expect(legend).toBeDefined();
    expect(champion).toBeDefined();
    expect(fillers).toHaveLength(13);
    expect(runes.length).toBeGreaterThanOrEqual(2);
    expect(battlefields).toHaveLength(3);
  });
});

describe('validateDeck', () => {
  it('accepts a legal 40-card deck', () => {
    const s = validateDeck(legalDeck(), CARDS_BY_ID, { tournament: true });
    expect(s.issues).toEqual([]);
    expect(s.isLegal).toBe(true);
    expect(s.mainCount).toBe(40);
  });

  it('requires a legend and champion', () => {
    const d = { ...legalDeck(), legendId: null, championId: null };
    expect(errors(d)).toEqual(expect.arrayContaining(['Choose a Legend.', 'Choose a Chosen Champion.']));
  });

  it('rejects a champion that does not match the legend', () => {
    const other = UNIQUE_CARDS.find((c) => c.supertypes.includes('champion') && !c.tags.includes('Jinx') && c.type === 'unit')!;
    expect(errors({ ...legalDeck(), championId: other.id }).join()).toMatch(/must be a Jinx champion/);
  });

  it('flags a short main deck, and 41 cards only in tournament mode', () => {
    const short = legalDeck();
    short.entries[0].quantity = 2;
    expect(errors(short).join()).toMatch(/at least 40/);

    const big = legalDeck();
    const extra = UNIQUE_CARDS.find((c) => c.type === 'spell' && c.supertypes.length === 0 && inDomains(c) && !fillers.includes(c))!;
    big.entries.push({ cardId: extra.id, zone: 'main', quantity: 1 });
    expect(errors(big)).toEqual([]);
    expect(errors(big, true).join()).toMatch(/exactly 40/);
  });

  it('enforces 3 copies across printings', () => {
    const d = legalDeck();
    const base = fillers[0];
    const alt = ALL_CARDS.find((c) => c.baseKey === base.baseKey && c.id !== base.id);
    d.entries.push({ cardId: alt?.id ?? base.id, zone: 'sideboard', quantity: 1 });
    expect(errors(d).join()).toMatch(/4 copies \(max 3\)/);
  });

  it('counts the chosen champion toward the copy limit', () => {
    const d = legalDeck();
    d.entries[0] = { cardId: champion.id, zone: 'main', quantity: 3 };
    expect(errors(d).join()).toMatch(/4 copies/);
  });

  it('flags cards outside the legend domains', () => {
    const off = UNIQUE_CARDS.find((c) => c.type === 'spell' && c.domains.length && !inDomains(c))!;
    const d = legalDeck();
    d.entries[0] = { cardId: off.id, zone: 'main', quantity: 3 };
    expect(errors(d).join()).toMatch(/outside your Legend's domains/);
  });

  it('needs exactly 12 runes', () => {
    const d = legalDeck();
    d.entries.find((e) => e.zone === 'rune')!.quantity = 5;
    expect(errors(d).join()).toMatch(/11 runes/);
  });

  it('needs 3 differently named battlefields', () => {
    const d = legalDeck();
    const bfs = d.entries.filter((e) => e.zone === 'battlefield');
    bfs[1].cardId = bfs[0].cardId;
    expect(errors(d).join()).toMatch(/different names/);
  });

  it('limits signature cards to 3 of the legend champion', () => {
    const sigs = ALL_CARDS.filter((c) => c.supertypes.includes('signature') && c.tags.includes('Jinx') && !c.isAltArt);
    expect(sigs.length).toBeGreaterThan(0);
    const d = legalDeck();
    d.entries[0] = { cardId: sigs[0].id, zone: 'main', quantity: 3 };
    d.entries[1] = { cardId: (sigs[1] ?? sigs[0]).id, zone: 'main', quantity: sigs[1] ? 3 : 0 };
    if (sigs[1]) expect(errors(d).join()).toMatch(/6 Signature cards/);

    const wrong = ALL_CARDS.find((c) => c.supertypes.includes('signature') && !c.tags.includes('Jinx') && inDomains(c));
    if (wrong) {
      const d2 = legalDeck();
      d2.entries[0] = { cardId: wrong.id, zone: 'main', quantity: 1 };
      expect(errors(d2).join()).toMatch(/Signature card; your Legend is Jinx/);
    }
  });

  it('rejects runes in the main deck and tokens anywhere', () => {
    const d = legalDeck();
    d.entries.push({ cardId: runes[0].id, zone: 'main', quantity: 1 });
    const token = ALL_CARDS.find((c) => c.supertypes.includes('token'))!;
    d.entries.push({ cardId: token.id, zone: 'sideboard', quantity: 1 });
    const msg = errors(d).join();
    expect(msg).toMatch(/belongs in the rune deck/);
    expect(msg).toMatch(/is a token/);
  });
});

describe('missingCards', () => {
  it('counts owned copies across printings and reports the shortfall', () => {
    const d = legalDeck();
    const owned = new Map<string, number>([[fillers[0].baseKey, 2], [legend.baseKey, 1]]);
    const lines = missingCards(d, CARDS_BY_ID, (k) => owned.get(k) ?? 0);
    const f0 = lines.find((l) => l.baseKey === fillers[0].baseKey)!;
    expect(f0).toMatchObject({ needed: 3, owned: 2, missing: 1 });
    expect(lines.find((l) => l.baseKey === legend.baseKey)!.missing).toBe(0);
    const runeLine = lines.find((l) => l.baseKey === runes[0].baseKey)!;
    expect(runeLine.needed).toBe(6);
  });
});

describe('maxQuantity (copy cap while editing)', () => {
  const card = fillers[0];
  const alt = ALL_CARDS.find((c) => c.baseKey === card.baseKey && c.id !== card.id);
  const deck = (entries: DeckEntry[], championId: string | null = null): DeckInput => ({ legendId: legend.id, championId, entries });

  it('allows up to 3 copies of a new card', () => {
    expect(maxQuantity(deck([]), card.id, 'main', CARDS_BY_ID)).toBe(3);
  });

  it('counts main deck and sideboard together', () => {
    const d = deck([{ cardId: card.id, zone: 'main', quantity: 2 }]);
    expect(maxQuantity(d, card.id, 'main', CARDS_BY_ID)).toBe(3);
    expect(maxQuantity(d, card.id, 'sideboard', CARDS_BY_ID)).toBe(1);
  });

  it('counts the Chosen Champion as a copy', () => {
    expect(maxQuantity(deck([], champion.id), champion.id, 'main', CARDS_BY_ID)).toBe(2);
  });

  it('counts other printings of the same card', () => {
    if (!alt) return;
    const d = deck([{ cardId: alt.id, zone: 'main', quantity: 3 }]);
    expect(maxQuantity(d, card.id, 'main', CARDS_BY_ID)).toBe(0);
  });

  it('does not cap runes, and never forces an over-limit deck down', () => {
    expect(maxQuantity(deck([]), runes[0].id, 'rune', CARDS_BY_ID)).toBe(Infinity);
    const d = deck([{ cardId: card.id, zone: 'main', quantity: 5 }]);
    expect(maxQuantity(d, card.id, 'main', CARDS_BY_ID)).toBe(5);
  });
});
