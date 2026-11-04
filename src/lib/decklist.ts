import type { Card } from '../types/card';
import { ALL_CARDS, UNIQUE_CARDS, displayName, isToken, legendChampion } from './cards';
import { defaultZone, type DeckEntry, type Zone } from './deckRules';

export interface ParsedDecklist {
  name: string | null;
  legendId: string | null;
  championId: string | null;
  entries: DeckEntry[];
  /** Lines that looked like cards but didn't match anything. */
  unknown: string[];
  /** Non-fatal notes, e.g. a name that matched several cards. */
  notes: string[];
}

type Section = Zone | 'legend' | 'champion' | null;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ---------------------------------------------------------------- name index
// Every way a decklist might write a card's name -> candidate cards (canonical printings).
const BY_NAME = new Map<string, Card[]>();
const add = (key: string, c: Card) => {
  const k = norm(key);
  if (!k) return;
  const list = BY_NAME.get(k) ?? [];
  if (!list.some((x) => x.baseKey === c.baseKey)) list.push(c);
  BY_NAME.set(k, list);
};
for (const c of UNIQUE_CARDS) {
  if (isToken(c)) continue;
  add(c.name, c);
  if (c.subtitle) add(`${c.name} ${c.subtitle}`, c); // "Jinx, Demolitionist" / "Jinx - Demolitionist"
  if (c.type === 'legend') {
    const champ = legendChampion(c);
    if (champ) {
      add(`${champ} ${c.name}`, c); // "Jinx, Loose Cannon"
      add(`${c.name} ${champ}`, c);
    }
  }
}
// Collector codes: "OGN-066", "OGN-066/298", "ogn066"
const BY_CODE = new Map<string, Card>();
for (const c of ALL_CARDS) {
  BY_CODE.set(c.code.toUpperCase(), c);
  BY_CODE.set(c.publicCode.toUpperCase(), c);
}
const CODE_RE = /\b([A-Z]{2,4})-?(\d{1,3}[a-z*]?|[A-Z]{1,2}\d{1,3}[a-z]?)(?:\/\d{1,3})?\b/i;

function findByCode(text: string): Card | undefined {
  const m = text.match(CODE_RE);
  if (!m) return undefined;
  const set = m[1].toUpperCase();
  let num = m[2];
  // Pad plain numbers: OGN-66 -> OGN-066
  if (/^\d+[a-z*]?$/i.test(num)) num = num.replace(/^\d+/, (d) => d.padStart(3, '0'));
  return BY_CODE.get(`${set}-${num}`.toUpperCase()) ?? BY_CODE.get(`${set}-${num.toLowerCase()}`.toUpperCase());
}

// ---------------------------------------------------------------- sections
const SECTION_WORDS: [RegExp, Section][] = [
  [/^(chosen\s+)?champion(\s+unit)?s?$/, 'champion'],
  [/^legends?$/, 'legend'],
  [/^(main(\s*deck)?|deck|maindeck|main\s+board|mainboard)$/, 'main'],
  [/^(runes?|rune\s*deck)$/, 'rune'],
  [/^(battlefields?|battle\s*fields?)$/, 'battlefield'],
  [/^(side\s*board|sideboard|side\s*deck|side)$/, 'sideboard'],
];
function sectionOf(label: string): Section | undefined {
  const l = label.toLowerCase().replace(/\(\d+\)/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, s] of SECTION_WORDS) if (re.test(l)) return s;
  return undefined;
}

/** "3 Jinx", "3x Jinx", "Jinx x3", "Jinx (OGN-030)", "1 Fury Rune" */
function splitQuantity(line: string): { qty: number; rest: string } {
  let m = line.match(/^(\d{1,2})\s*[x×]?\s+(.+)$/i);
  if (m) return { qty: Number(m[1]), rest: m[2] };
  m = line.match(/^(.+?)\s+[x×]\s*(\d{1,2})$/i) ?? line.match(/^(.+?)\s+(\d{1,2})$/);
  if (m) return { qty: Number(m[2]), rest: m[1] };
  return { qty: 1, rest: line };
}

function resolve(text: string, notes: string[]): Card | undefined {
  const byCode = findByCode(text);
  if (byCode) return byCode;
  const nameOnly = text.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').trim();
  const hits = BY_NAME.get(norm(nameOnly));
  if (!hits?.length) return undefined;
  if (hits.length > 1)
    notes.push(`"${nameOnly}" matches ${hits.length} cards (${hits.map(displayName).join(', ')}); used ${displayName(hits[0])}.`);
  return hits[0];
}

// ---------------------------------------------------------------- parse
export function parseDecklist(text: string): ParsedDecklist {
  const out: ParsedDecklist = { name: null, legendId: null, championId: null, entries: [], unknown: [], notes: [] };
  const qty = new Map<string, number>(); // `${cardId}|${zone}` -> n
  const addEntry = (c: Card, zone: Zone, n: number) => {
    const k = `${c.id}|${zone}`;
    qty.set(k, (qty.get(k) ?? 0) + n);
  };
  const championCandidates: Card[] = [];
  let section: Section = null;

  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(/^[-*•]\s+/, '');
    if (!line || /^\/\//.test(line)) continue;

    // "# Deck name" (our export) or "Name: ..." metadata
    const title = line.match(/^#\s*(.+)$/);
    if (title) {
      const s = sectionOf(title[1]);
      if (s !== undefined) section = s;
      else out.name ??= title[1].trim();
      continue;
    }
    const nameMeta = line.match(/^(deck\s*name|name|title)\s*:\s*(.+)$/i);
    if (nameMeta) {
      out.name ??= nameMeta[2].trim();
      continue;
    }

    // "Main deck:" / "Runes (12)" / "Legend: Jinx, Loose Cannon"
    const header = line.match(/^([A-Za-z][A-Za-z\s]*?)\s*(?:\(\d+\))?\s*:\s*(.*)$/);
    if (header) {
      const s = sectionOf(header[1]);
      if (s !== undefined) {
        section = s;
        line = header[2].trim();
        if (!line) continue;
      }
    } else {
      const bare = sectionOf(line);
      if (bare !== undefined) {
        section = bare;
        continue;
      }
    }

    const { qty: n, rest } = splitQuantity(line);
    const card = resolve(rest, out.notes);
    if (!card) {
      out.unknown.push(raw.trim());
      continue;
    }

    // The card's own type wins over the section for legends / runes / battlefields.
    if (card.type === 'legend') {
      if (!out.legendId) out.legendId = card.id;
      else if (out.legendId !== card.id) out.notes.push(`Ignored a second Legend: ${displayName(card)}.`);
      continue;
    }
    if (section === 'champion' && card.supertypes.includes('champion')) {
      if (!out.championId) out.championId = card.id;
      if (n > 1) addEntry(card, 'main', n - 1);
      continue;
    }
    const typeZone = defaultZone(card);
    const zone: Zone = typeZone !== 'main' ? typeZone : section === 'sideboard' ? 'sideboard' : 'main';
    if (zone === 'main' && card.supertypes.includes('champion')) championCandidates.push(card);
    addEntry(card, zone, n);
  }

  // No explicit Chosen Champion: take one copy of a matching champion from the main deck.
  if (!out.championId && out.legendId) {
    const tag = legendChampion(ALL_CARDS.find((c) => c.id === out.legendId)!);
    const pick = championCandidates.find((c) => tag && c.tags.includes(tag));
    if (pick) {
      out.championId = pick.id;
      const k = `${pick.id}|main`;
      const left = (qty.get(k) ?? 0) - 1;
      if (left > 0) qty.set(k, left);
      else qty.delete(k);
      out.notes.push(`Used ${displayName(pick)} from the main deck as the Chosen Champion.`);
    }
  }

  out.entries = [...qty.entries()].map(([k, quantity]) => {
    const [cardId, zone] = k.split('|') as [string, Zone];
    return { cardId, zone, quantity };
  });
  return out;
}
