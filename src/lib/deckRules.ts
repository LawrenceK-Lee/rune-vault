import type { Card } from '../types/card';
import { displayName, isToken, legendChampion } from './cards';

// Constructed deck rules. Kept here so they're easy to update when Riot changes them.
export const RULES = {
  mainDeckMin: 40,
  /** Sanctioned Constructed events require exactly this many main-deck cards. */
  tournamentMainDeckSize: 40,
  maxCopies: 3,
  runeCount: 12,
  battlefieldCount: 3,
  maxSignatureCards: 3,
  /** Sources disagree (8 vs 10); 8 is the most commonly cited tournament figure. */
  sideboardMax: 8,
};

export type Zone = 'main' | 'rune' | 'battlefield' | 'sideboard';
export const ZONES: Zone[] = ['main', 'rune', 'battlefield', 'sideboard'];

export interface DeckEntry {
  cardId: string;
  zone: Zone;
  quantity: number;
}

export interface DeckInput {
  legendId: string | null;
  championId: string | null;
  entries: DeckEntry[];
}

export interface RuleIssue {
  level: 'error' | 'warning';
  message: string;
  cardIds?: string[];
}

export interface DeckSummary {
  mainCount: number; // includes the chosen champion
  runeCount: number;
  battlefieldCount: number;
  sideboardCount: number;
  issues: RuleIssue[];
  isLegal: boolean;
}

export function zoneCount(entries: DeckEntry[], zone: Zone) {
  return entries.reduce((n, e) => (e.zone === zone ? n + e.quantity : n), 0);
}

/** Which zone a card goes into by default when added to a deck. */
export function defaultZone(card: Card): Zone {
  if (card.type === 'rune') return 'rune';
  if (card.type === 'battlefield') return 'battlefield';
  return 'main';
}

/** True if every domain on the card is colorless or one of the legend's domains. */
export function fitsDomains(card: Card, legend: Card | null) {
  if (!legend) return true;
  return card.domains.every((d) => d === 'colorless' || legend.domains.includes(d));
}

export function validateDeck(
  deck: DeckInput,
  cardsById: Map<string, Card>,
  opts: { tournament?: boolean } = {},
): DeckSummary {
  const issues: RuleIssue[] = [];
  const err = (message: string, cardIds?: string[]) => issues.push({ level: 'error', message, cardIds });
  const warn = (message: string, cardIds?: string[]) => issues.push({ level: 'warning', message, cardIds });

  const legend = deck.legendId ? cardsById.get(deck.legendId) ?? null : null;
  const champion = deck.championId ? cardsById.get(deck.championId) ?? null : null;
  const tag = legend ? legendChampion(legend) : null;

  const entries = deck.entries.filter((e) => e.quantity > 0);
  const unknown = entries.filter((e) => !cardsById.has(e.cardId));
  if (unknown.length) warn(`${unknown.length} card(s) in this deck are no longer in the card database.`);
  const known = entries.filter((e) => cardsById.has(e.cardId));
  const card = (id: string) => cardsById.get(id)!;

  // --- Legend --------------------------------------------------------------
  if (!legend) err('Choose a Legend.');
  else if (legend.type !== 'legend') err(`${displayName(legend)} is not a Legend.`, [legend.id]);

  // --- Chosen Champion ------------------------------------------------------
  if (!champion) err('Choose a Chosen Champion.');
  else {
    if (champion.type !== 'unit' || !champion.supertypes.includes('champion'))
      err(`${displayName(champion)} is not a champion unit.`, [champion.id]);
    else if (tag && !champion.tags.includes(tag))
      err(`Chosen Champion must be a ${tag} champion unit.`, [champion.id]);
  }

  // --- Zone contents ----------------------------------------------------------
  for (const e of known) {
    const c = card(e.cardId);
    if (isToken(c)) err(`${displayName(c)} is a token and can't be in a deck.`, [c.id]);
    else if (c.type === 'legend') err(`${displayName(c)}: Legends go in the Legend slot, not the deck.`, [c.id]);
    else if (e.zone === 'rune' && c.type !== 'rune') err(`${displayName(c)} is not a rune.`, [c.id]);
    else if (e.zone === 'battlefield' && c.type !== 'battlefield') err(`${displayName(c)} is not a battlefield.`, [c.id]);
    else if ((e.zone === 'main' || e.zone === 'sideboard') && (c.type === 'rune' || c.type === 'battlefield'))
      err(`${displayName(c)} belongs in the ${c.type} deck, not the ${e.zone === 'main' ? 'main deck' : 'sideboard'}.`, [c.id]);
  }

  // --- Counts ---------------------------------------------------------------
  const mainCount = zoneCount(known, 'main') + (champion ? 1 : 0);
  const runeCount = zoneCount(known, 'rune');
  const battlefieldCount = zoneCount(known, 'battlefield');
  const sideboardCount = zoneCount(known, 'sideboard');

  if (opts.tournament) {
    if (mainCount !== RULES.tournamentMainDeckSize)
      err(`Main deck has ${mainCount} cards; tournament decks need exactly ${RULES.tournamentMainDeckSize} (including the Chosen Champion).`);
  } else if (mainCount < RULES.mainDeckMin) {
    err(`Main deck has ${mainCount} cards; it needs at least ${RULES.mainDeckMin} (including the Chosen Champion).`);
  }
  if (runeCount !== RULES.runeCount) err(`Rune deck has ${runeCount} runes; it needs exactly ${RULES.runeCount}.`);
  if (battlefieldCount !== RULES.battlefieldCount)
    err(`You have ${battlefieldCount} battlefields; you need exactly ${RULES.battlefieldCount}.`);
  if (sideboardCount > RULES.sideboardMax)
    warn(`Sideboard has ${sideboardCount} cards; the usual limit is ${RULES.sideboardMax}.`);

  // --- Battlefields must have different names --------------------------------
  const bfNames = new Map<string, string[]>();
  for (const e of known.filter((e) => e.zone === 'battlefield')) {
    const c = card(e.cardId);
    const ids = bfNames.get(c.name) ?? [];
    for (let i = 0; i < e.quantity; i++) ids.push(c.id);
    bfNames.set(c.name, ids);
  }
  for (const [name, ids] of bfNames) if (ids.length > 1) err(`Battlefields must have different names (${name} ×${ids.length}).`, ids);

  // --- Copy limit, across main deck + sideboard, all printings ----------------
  const copies = new Map<string, { n: number; ids: string[]; card: Card }>();
  const addCopy = (c: Card, n: number) => {
    const cur = copies.get(c.baseKey) ?? { n: 0, ids: [], card: c };
    cur.n += n;
    cur.ids.push(c.id);
    copies.set(c.baseKey, cur);
  };
  if (champion) addCopy(champion, 1);
  for (const e of known) if (e.zone === 'main' || e.zone === 'sideboard') addCopy(card(e.cardId), e.quantity);
  for (const { n, ids, card: c } of copies.values())
    if (n > RULES.maxCopies) err(`${displayName(c)}: ${n} copies (max ${RULES.maxCopies}).`, ids);

  // --- Domain identity ------------------------------------------------------
  if (legend) {
    const off = new Set<string>();
    for (const e of known) {
      const c = card(e.cardId);
      if (!fitsDomains(c, legend)) off.add(c.id);
    }
    if (champion && !fitsDomains(champion, legend)) off.add(champion.id);
    if (off.size)
      err(
        `${off.size} card(s) are outside your Legend's domains (${legend.domains.join(' / ')}).`,
        [...off],
      );
  }

  // --- Signature cards --------------------------------------------------------
  const sigIds: string[] = [];
  let sigCount = 0;
  for (const e of known) {
    if (e.zone !== 'main' && e.zone !== 'sideboard') continue;
    const c = card(e.cardId);
    if (!c.supertypes.includes('signature')) continue;
    sigIds.push(c.id);
    if (e.zone === 'main') sigCount += e.quantity;
    if (tag && !c.tags.includes(tag)) err(`${displayName(c)} is a ${c.tags.join('/')} Signature card; your Legend is ${tag}.`, [c.id]);
  }
  if (sigCount > RULES.maxSignatureCards)
    err(`${sigCount} Signature cards in the main deck (max ${RULES.maxSignatureCards}).`, sigIds);

  return {
    mainCount,
    runeCount,
    battlefieldCount,
    sideboardCount,
    issues,
    isLegal: !issues.some((i) => i.level === 'error'),
  };
}

export interface MissingLine {
  baseKey: string;
  card: Card;
  needed: number;
  owned: number;
  missing: number;
}

/**
 * Compare a deck against the collection. Owned copies are counted across every
 * printing of a card (an alt-art copy works just as well as the base one).
 * Sideboard is included because you need those cards physically too.
 */
export function missingCards(
  deck: DeckInput,
  cardsById: Map<string, Card>,
  ownedByBaseKey: (baseKey: string) => number,
): MissingLine[] {
  const need = new Map<string, { n: number; card: Card }>();
  const add = (id: string | null, n: number) => {
    const c = id ? cardsById.get(id) : undefined;
    if (!c) return;
    const cur = need.get(c.baseKey) ?? { n: 0, card: c };
    cur.n += n;
    need.set(c.baseKey, cur);
  };
  add(deck.legendId, 1);
  add(deck.championId, 1);
  for (const e of deck.entries) add(e.cardId, e.quantity);

  return [...need.entries()]
    .map(([baseKey, { n, card }]) => {
      const owned = ownedByBaseKey(baseKey);
      return { baseKey, card, needed: n, owned, missing: Math.max(0, n - owned) };
    })
    .sort((a, b) => b.missing - a.missing || displayName(a.card).localeCompare(displayName(b.card)));
}
