import { describe, expect, it } from 'vitest';
import { ALL_CARDS, UNIQUE_CARDS, displayName } from './cards';
import { parseCollectionRows, parseCsv } from './collectionImport';

const jinx = UNIQUE_CARDS.find((c) => c.name === 'Jinx' && c.type === 'unit')!;
const unit = UNIQUE_CARDS.find((c) => c.set === 'OGN' && c.type === 'unit' && !c.subtitle && c.supertypes.length === 0)!;
const alt = ALL_CARDS.find((c) => c.isAltArt && c.set === 'OGN')!;
const byId = (r: ReturnType<typeof parseCollectionRows>) => Object.fromEntries(r.items.map((i) => [i.card.id, i.quantity]));

describe('parseCsv', () => {
  it('handles quotes, commas, semicolons and CRLF', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
    expect(parseCsv('name;qty\nJinx;2')).toEqual([['name', 'qty'], ['Jinx', '2']]);
  });
});

describe('parseCollectionRows', () => {
  it("round-trips this app's own CSV export, keeping exact printings", () => {
    const rows = parseCsv(`code,name,set,rarity,quantity,card_id\n${alt.publicCode},"${displayName(alt)}",Origins,epic,2,${alt.id}\n${unit.publicCode},${unit.name},Origins,common,3,${unit.id}`);
    expect(byId(parseCollectionRows(rows))).toEqual({ [alt.id]: 2, [unit.id]: 3 });
  });

  it('reads spreadsheets with set + card number columns and sums duplicates', () => {
    const num = unit.code.split('-')[1];
    const rows = [['Quantity', 'Name', 'Set', 'Card Number'], [2, unit.name, 'Riftbound: Origins', `${num}/298`], [1, unit.name, 'OGN', Number(num)]];
    const r = parseCollectionRows(rows);
    expect(byId(r)).toEqual({ [unit.id]: 3 });
    expect(r.copies).toBe(3);
  });

  it('matches by name when there is no code, and reports unknown rows', () => {
    const r = parseCollectionRows([['Card Name', 'Owned'], [displayName(jinx), '4'], ['Definitely Not A Card', 1], [unit.name, '']]);
    expect(byId(r)).toEqual({ [jinx.id]: 4 });
    expect(r.unknown).toEqual(['Definitely Not A Card · 1']);
  });

  it('reads header-less lists like "3x Name" or code + quantity', () => {
    const r = parseCollectionRows([[`3x ${unit.name}`], [jinx.publicCode, 2]]);
    expect(byId(r)).toEqual({ [unit.id]: 3, [jinx.id]: 2 });
  });
});
