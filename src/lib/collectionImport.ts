import type { Card } from '../types/card';
import { CARDS_BY_ID, SETS, displayName } from './cards';
import { findByCode, findCard } from './decklist';

export type Cell = string | number | boolean | Date | null | undefined;

export interface ParsedCollection {
  items: { card: Card; quantity: number }[];
  /** Rows that had something in them but didn't match a card. */
  unknown: string[];
  notes: string[];
  /** Total copies across all matched rows. */
  copies: number;
}

// ---------------------------------------------------------------- file reading
/** Read the first sheet of an Excel file, a CSV/TSV, or this app's JSON export into rows of cells. */
export async function readCollectionFile(file: File): Promise<Cell[][]> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xlsx' || ext === 'xlsm') {
    const { readSheet } = await import('read-excel-file/browser');
    return (await readSheet(file)) as Cell[][];
  }
  if (ext === 'xls') throw new Error('Old .xls files aren\'t supported. In Excel, use File → Save As → Excel Workbook (.xlsx) or CSV, then import that.');
  if (ext === 'ods' || ext === 'numbers') throw new Error('Save the spreadsheet as Excel (.xlsx) or CSV first, then import that.');
  const text = await file.text();
  if (ext === 'json' || /^\s*\[/.test(text)) return jsonRows(text);
  return parseCsv(text);
}

function jsonRows(text: string): Cell[][] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Expected a JSON list of cards, like the one this app exports.');
  return [['card_id', 'quantity', 'code', 'name'], ...data.map((r) => [r?.card_id, r?.quantity, r?.code, r?.name] as Cell[])];
}

/** RFC 4180-ish CSV with auto-detected delimiter (comma, semicolon or tab). */
export function parseCsv(text: string): Cell[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'));
  const delim = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------- matching
const str = (v: Cell) => (v instanceof Date ? '' : v == null ? '' : String(v).trim());
const head = (v: Cell) => str(v).toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

const COLUMNS = {
  quantity: /^(qty|quantity|count|owned|copies|amount|have|total|total quantity|number owned|# owned|add to quantity)$/,
  cardId: /^card id$/,
  code: /^(code|card code|collector code|public code|id)$/,
  set: /^(set|set code|set name|set id|expansion|edition)$/,
  number: /^(no|#|number|card no|card number|card #|collector no|collector number|collector #)$/,
  name: /^(name|card|card name|title|simple name)$/,
} as const;
type Column = keyof typeof COLUMNS;

function findHeader(rows: Cell[][]): { index: number; cols: Partial<Record<Column, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cols: Partial<Record<Column, number>> = {};
    rows[i].forEach((v, c) => {
      const h = head(v);
      for (const k of Object.keys(COLUMNS) as Column[]) if (cols[k] == null && COLUMNS[k].test(h)) cols[k] = c;
    });
    if (cols.cardId != null || cols.code != null || cols.name != null || (cols.set != null && cols.number != null)) return { index: i, cols };
  }
  return null;
}

const SET_IDS = new Map<string, string>(SETS.flatMap((s) => [[s.id.toLowerCase(), s.id], [s.name.toLowerCase(), s.id]]));

function toQuantity(v: Cell): number | null {
  const s = str(v);
  if (s === '') return null;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function matchWithHeader(row: Cell[], cols: Partial<Record<Column, number>>, notes: string[]): Card | undefined {
  const at = (k: Column) => (cols[k] == null ? '' : str(row[cols[k]!]));
  const id = at('cardId') || at('code');
  if (id) {
    const c = CARDS_BY_ID.get(id.toLowerCase()) ?? findByCode(id);
    if (c) return c;
  }
  const set = SET_IDS.get(at('set').toLowerCase().replace(/^riftbound\s*[:\-–]?\s*/, '')) ?? at('set');
  const num = at('number');
  if (set && num) {
    const c = findByCode(`${set}-${num}`) ?? findByCode(num);
    if (c) return c;
  } else if (num) {
    const c = findByCode(num);
    if (c) return c;
  }
  const name = at('name');
  return name ? findCard(name, notes) : undefined;
}

/** Rows without a header: find a card code or name in the cells, and a number for the quantity. */
function matchWithoutHeader(row: Cell[], notes: string[]): { card?: Card; quantity: number | null } {
  const cells = row.map(str).filter(Boolean);
  if (cells.length === 1) {
    const m = cells[0].match(/^(\d{1,3})\s*[x×]?\s+(.+)$/i) ?? cells[0].match(/^(.+?)\s+[x×]\s*(\d{1,3})$/i);
    if (m) {
      const [q, text] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
      return { card: findCard(text, notes), quantity: Number(q) };
    }
    return { card: findCard(cells[0], notes), quantity: null };
  }
  const numbers = cells.filter((c) => /^\d{1,3}$/.test(c));
  const texts = cells.filter((c) => !/^\d{1,3}$/.test(c));
  const card = texts.map((t) => CARDS_BY_ID.get(t.toLowerCase()) ?? findByCode(t)).find(Boolean) ?? findCard(texts.join(' '), notes) ?? texts.map((t) => findCard(t, notes)).find(Boolean);
  return { card, quantity: numbers.length ? Number(numbers[0]) : null };
}

export function parseCollectionRows(rows: Cell[][]): ParsedCollection {
  const notes: string[] = [];
  const unknown: string[] = [];
  const totals = new Map<string, number>();
  const header = findHeader(rows);
  const body = header ? rows.slice(header.index + 1) : rows;

  for (const row of body) {
    if (!row.some((v) => str(v) !== '')) continue;
    let card: Card | undefined;
    let quantity: number | null;
    if (header) {
      card = matchWithHeader(row, header.cols, notes);
      // With a quantity column, a blank cell means none; without one, each row is one copy.
      quantity = header.cols.quantity != null ? toQuantity(row[header.cols.quantity]) ?? 0 : 1;
    } else {
      ({ card, quantity } = matchWithoutHeader(row, notes));
      quantity ??= 1;
    }
    if (!card) {
      unknown.push(row.map(str).filter(Boolean).join(' · '));
      continue;
    }
    if (quantity > 0) totals.set(card.id, (totals.get(card.id) ?? 0) + quantity);
  }

  if (header && header.cols.quantity == null) notes.push('No quantity column found, so each row counts as one copy.');
  const items = [...totals].map(([id, quantity]) => ({ card: CARDS_BY_ID.get(id)!, quantity }));
  items.sort((a, b) => displayName(a.card).localeCompare(displayName(b.card)));
  return { items, unknown, notes: [...new Set(notes)], copies: items.reduce((n, i) => n + i.quantity, 0) };
}
