import { supabase, type CollectionRow, type DeckCardRow, type DeckRow } from './supabase';
import type { DeckEntry, Zone } from './deckRules';

export interface DeckWithCards extends DeckRow {
  deck_cards: DeckCardRow[];
}

export interface NewDeck {
  name: string;
  notes?: string | null;
  legend_id?: string | null;
  champion_id?: string | null;
  entries?: DeckEntry[];
}

export type DeckPatch = Pick<DeckRow, 'name' | 'notes' | 'legend_id' | 'champion_id'>;

/**
 * Where the collection and decks are kept: the signed-in user's Supabase rows, or
 * (for guests) this browser's localStorage. Both behave the same to the rest of the app.
 */
export interface DataStore {
  kind: 'cloud' | 'local';
  listCollection(): Promise<CollectionRow[]>;
  setQuantity(cardId: string, quantity: number): Promise<void>;
  /** Set these cards' quantities (rows with quantity 0 are ignored). */
  upsertCollection(rows: CollectionRow[]): Promise<void>;
  listDecks(): Promise<DeckWithCards[]>;
  getDeck(id: string): Promise<DeckWithCards>;
  createDeck(input: NewDeck): Promise<DeckRow>;
  deleteDeck(id: string): Promise<void>;
  updateDeck(id: string, patch: DeckPatch): Promise<void>;
  upsertDeckCards(rows: DeckCardRow[]): Promise<void>;
  deleteDeckCards(deckId: string, keys: { card_id: string; zone: Zone }[]): Promise<void>;
}

// ---------------------------------------------------------------- Supabase
export function cloudStore(userId: string): DataStore {
  return {
    kind: 'cloud',
    async listCollection() {
      // Page through in case a collection grows past the default 1000-row limit.
      const rows: CollectionRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('collection_items').select('card_id, quantity').gt('quantity', 0).range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    },
    async setQuantity(cardId, quantity) {
      const { error } =
        quantity <= 0
          ? await supabase.from('collection_items').delete().eq('card_id', cardId)
          : await supabase.from('collection_items').upsert({ user_id: userId, card_id: cardId, quantity, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    async upsertCollection(rows) {
      const clean = rows.filter((r) => r.quantity > 0);
      for (let i = 0; i < clean.length; i += 500) {
        const { error } = await supabase.from('collection_items').upsert(clean.slice(i, i + 500).map((r) => ({ ...r, user_id: userId })));
        if (error) throw error;
      }
    },
    async listDecks() {
      const { data, error } = await supabase.from('decks').select('*, deck_cards(*)').order('updated_at', { ascending: false });
      if (error) throw error;
      return data as DeckWithCards[];
    },
    async getDeck(id) {
      const { data, error } = await supabase.from('decks').select('*, deck_cards(*)').eq('id', id).single();
      if (error) throw error;
      return data as DeckWithCards;
    },
    async createDeck(input) {
      const { data, error } = await supabase
        .from('decks')
        .insert({ name: input.name, notes: input.notes ?? null, legend_id: input.legend_id ?? null, champion_id: input.champion_id ?? null })
        .select()
        .single();
      if (error) throw error;
      if (input.entries?.length) {
        const { error: e2 } = await supabase
          .from('deck_cards')
          .insert(input.entries.map((e) => ({ deck_id: data.id, card_id: e.cardId, zone: e.zone, quantity: e.quantity })));
        if (e2) throw e2;
      }
      return data as DeckRow;
    },
    async deleteDeck(id) {
      const { error } = await supabase.from('decks').delete().eq('id', id);
      if (error) throw error;
    },
    async updateDeck(id, patch) {
      const { error } = await supabase.from('decks').update(patch).eq('id', id);
      if (error) throw error;
    },
    async upsertDeckCards(rows) {
      if (!rows.length) return;
      const { error } = await supabase.from('deck_cards').upsert(rows);
      if (error) throw error;
    },
    async deleteDeckCards(deckId, keys) {
      for (const k of keys) {
        const { error } = await supabase.from('deck_cards').delete().match({ deck_id: deckId, card_id: k.card_id, zone: k.zone });
        if (error) throw error;
      }
    },
  };
}

// ---------------------------------------------------------------- this browser (guests)
export const GUEST_STORAGE_KEY = 'rv.guest.v1';

interface GuestData {
  collection: Record<string, number>;
  decks: DeckWithCards[];
}

const empty = (): GuestData => ({ collection: {}, decks: [] });

export function readGuestData(): GuestData {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw) as Partial<GuestData>;
    return { collection: d.collection ?? {}, decks: Array.isArray(d.decks) ? d.decks : [] };
  } catch {
    return empty();
  }
}

function writeGuestData(d: GuestData) {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(d));
  } catch {
    throw new Error("Couldn't save in this browser. Its storage may be full or blocked (private browsing can do this). Sign in to save to an account instead.");
  }
}

export function clearGuestData() {
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** How much a guest has saved in this browser. */
export function guestDataSummary() {
  const d = readGuestData();
  return { cards: Object.values(d.collection).reduce((n, q) => n + q, 0), decks: d.decks.length };
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();

/** Apply a change to the stored guest data and save it. */
function change<T>(fn: (d: GuestData) => T): T {
  const d = readGuestData();
  const result = fn(d);
  writeGuestData(d);
  return result;
}

function findDeck(d: GuestData, id: string) {
  const deck = d.decks.find((x) => x.id === id);
  if (!deck) throw new Error('Deck not found.');
  return deck;
}

export const localStore: DataStore = {
  kind: 'local',
  async listCollection() {
    return Object.entries(readGuestData().collection)
      .filter(([, q]) => q > 0)
      .map(([card_id, quantity]) => ({ card_id, quantity }));
  },
  async setQuantity(cardId, quantity) {
    change((d) => {
      if (quantity > 0) d.collection[cardId] = quantity;
      else delete d.collection[cardId];
    });
  },
  async upsertCollection(rows) {
    change((d) => {
      for (const r of rows) if (r.quantity > 0) d.collection[r.card_id] = r.quantity;
    });
  },
  async listDecks() {
    return [...readGuestData().decks].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  async getDeck(id) {
    return findDeck(readGuestData(), id);
  },
  async createDeck(input) {
    return change((d) => {
      const id = newId();
      const deck: DeckWithCards = {
        id,
        name: input.name,
        notes: input.notes ?? null,
        legend_id: input.legend_id ?? null,
        champion_id: input.champion_id ?? null,
        created_at: now(),
        updated_at: now(),
        deck_cards: (input.entries ?? []).map((e) => ({ deck_id: id, card_id: e.cardId, zone: e.zone, quantity: e.quantity })),
      };
      d.decks.push(deck);
      const { deck_cards: _cards, ...row } = deck;
      return row;
    });
  },
  async deleteDeck(id) {
    change((d) => {
      d.decks = d.decks.filter((x) => x.id !== id);
    });
  },
  async updateDeck(id, patch) {
    change((d) => {
      Object.assign(findDeck(d, id), patch, { updated_at: now() });
    });
  },
  async upsertDeckCards(rows) {
    if (!rows.length) return;
    change((d) => {
      for (const r of rows) {
        const deck = findDeck(d, r.deck_id);
        const i = deck.deck_cards.findIndex((c) => c.card_id === r.card_id && c.zone === r.zone);
        if (i === -1) deck.deck_cards.push({ ...r });
        else deck.deck_cards[i] = { ...r };
        deck.updated_at = now();
      }
    });
  },
  async deleteDeckCards(deckId, keys) {
    if (!keys.length) return;
    change((d) => {
      const deck = findDeck(d, deckId);
      deck.deck_cards = deck.deck_cards.filter((c) => !keys.some((k) => k.card_id === c.card_id && k.zone === c.zone));
      deck.updated_at = now();
    });
  },
};

/**
 * Copy a guest's browser data into their account: collection counts are added to what the
 * account already has, and each deck is created as a new deck. The browser copy is then cleared.
 */
export async function moveGuestDataToAccount(userId: string): Promise<{ cards: number; decks: number }> {
  const guest = readGuestData();
  const cloud = cloudStore(userId);
  const existing = new Map((await cloud.listCollection()).map((r) => [r.card_id, r.quantity]));
  const rows = Object.entries(guest.collection)
    .filter(([, q]) => q > 0)
    .map(([card_id, q]) => ({ card_id, quantity: (existing.get(card_id) ?? 0) + q }));
  await cloud.upsertCollection(rows);
  for (const deck of guest.decks) {
    await cloud.createDeck({
      name: deck.name,
      notes: deck.notes,
      legend_id: deck.legend_id,
      champion_id: deck.champion_id,
      entries: deck.deck_cards.map((c) => ({ cardId: c.card_id, zone: c.zone, quantity: c.quantity })),
    });
  }
  clearGuestData();
  return { cards: Object.values(guest.collection).reduce((n, q) => n + q, 0), decks: guest.decks.length };
}
