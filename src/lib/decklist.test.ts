import { describe, expect, it } from 'vitest';
import { parseDecklist } from './decklist';
import { CARDS_BY_ID } from './cards';

const nameOf = (id: string | null) => (id ? CARDS_BY_ID.get(id)?.name : null);
const count = (p: ReturnType<typeof parseDecklist>, zone: string) =>
  p.entries.filter((e) => e.zone === zone).reduce((n, e) => n + e.quantity, 0);

describe('parseDecklist', () => {
  it("reads this app's own exported format", () => {
    const p = parseDecklist(`# Jinx Aggro
Legend: Loose Cannon
Champion: Jinx, Demolitionist

Main deck:
3 Blazing Scorcher (OGN-001/298)
3 Brazen Buccaneer (OGN-002/298)

Runes:
6 Fury Rune (OGN-007/298)
6 Chaos Rune (OGN-166/298)

Battlefields:
1 Altar to Unity (OGN-275/298)
1 Aspirant's Climb (OGN-276/298)
1 Back-Alley Bar (OGN-277/298)`);
    expect(p.name).toBe('Jinx Aggro');
    expect(nameOf(p.legendId)).toBe('Loose Cannon');
    expect(CARDS_BY_ID.get(p.championId!)?.subtitle).toBe('Demolitionist');
    expect(count(p, 'main')).toBe(6);
    expect(count(p, 'rune')).toBe(12);
    expect(count(p, 'battlefield')).toBe(3);
    expect(p.unknown).toEqual([]);
  });

  it('handles "3x Name", "Name x2", dashes, legend written with champion, and no section headers', () => {
    const p = parseDecklist(`1 Jinx, Loose Cannon
3x Jinx - Rebel
2 Blazing Scorcher
Brazen Buccaneer x2
12 Fury Rune
1 Altar to Unity`);
    expect(nameOf(p.legendId)).toBe('Loose Cannon');
    // One Jinx, Rebel becomes the Chosen Champion; the other two stay in the main deck.
    expect(CARDS_BY_ID.get(p.championId!)?.subtitle).toBe('Rebel');
    expect(count(p, 'main')).toBe(2 + 2 + 2);
    expect(count(p, 'rune')).toBe(12);
    expect(count(p, 'battlefield')).toBe(1);
  });

  it('puts sideboard cards in the sideboard and reports unknown lines', () => {
    const p = parseDecklist(`Main Deck (40)
3 Blazing Scorcher
Sideboard:
2 Brazen Buccaneer
1 Definitely Not A Card`);
    expect(count(p, 'main')).toBe(3);
    expect(count(p, 'sideboard')).toBe(2);
    expect(p.unknown).toEqual(['1 Definitely Not A Card']);
  });

  it('matches cards by collector code alone', () => {
    const p = parseDecklist('3 OGN-001\n2 ogn-2');
    expect(p.entries.map((e) => nameOf(e.cardId))).toEqual(['Blazing Scorcher', 'Brazen Buccaneer']);
  });
});
