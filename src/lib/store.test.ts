import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal localStorage for the node test environment.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
});

const { localStore, guestDataSummary, clearGuestData, GUEST_STORAGE_KEY } = await import('./store');

beforeEach(() => mem.clear());

describe('localStore (guest data in this browser)', () => {
  it('stores collection quantities and removes cards set to 0', async () => {
    await localStore.setQuantity('ogn-001-298', 3);
    await localStore.upsertCollection([{ card_id: 'ogn-004-298', quantity: 2 }, { card_id: 'ogn-005-298', quantity: 0 }]);
    await localStore.setQuantity('ogn-001-298', 0);
    expect(await localStore.listCollection()).toEqual([{ card_id: 'ogn-004-298', quantity: 2 }]);
    expect(JSON.parse(mem.get(GUEST_STORAGE_KEY)!).collection).toEqual({ 'ogn-004-298': 2 });
  });

  it('creates, edits and deletes decks', async () => {
    const deck = await localStore.createDeck({ name: 'Jinx', entries: [{ cardId: 'ogn-001-298', zone: 'main', quantity: 3 }] });
    await localStore.updateDeck(deck.id, { name: 'Jinx aggro', notes: null, legend_id: 'L', champion_id: 'C' });
    await localStore.upsertDeckCards([
      { deck_id: deck.id, card_id: 'ogn-001-298', zone: 'main', quantity: 2 },
      { deck_id: deck.id, card_id: 'ogn-004-298', zone: 'sideboard', quantity: 1 },
    ]);
    await localStore.deleteDeckCards(deck.id, [{ card_id: 'ogn-004-298', zone: 'sideboard' }]);
    const got = await localStore.getDeck(deck.id);
    expect(got).toMatchObject({ name: 'Jinx aggro', legend_id: 'L', champion_id: 'C' });
    expect(got.deck_cards).toEqual([{ deck_id: deck.id, card_id: 'ogn-001-298', zone: 'main', quantity: 2 }]);
    expect(guestDataSummary()).toEqual({ cards: 0, decks: 1 });
    await localStore.deleteDeck(deck.id);
    expect(await localStore.listDecks()).toEqual([]);
    await expect(localStore.getDeck(deck.id)).rejects.toThrow('Deck not found');
  });

  it('recovers from corrupt storage and can be cleared', async () => {
    mem.set(GUEST_STORAGE_KEY, '{not json');
    expect(await localStore.listCollection()).toEqual([]);
    await localStore.setQuantity('ogn-001-298', 1);
    expect(guestDataSummary()).toEqual({ cards: 1, decks: 0 });
    clearGuestData();
    expect(guestDataSummary()).toEqual({ cards: 0, decks: 0 });
  });
});
