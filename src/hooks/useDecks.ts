import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type DeckCardRow, type DeckRow } from '../lib/supabase';
import { maxQuantity, type DeckEntry, type DeckInput, type Zone } from '../lib/deckRules';
import { CARDS_BY_ID } from '../lib/cards';
import { useUserId } from './useAuth';

export interface DeckWithCards extends DeckRow {
  deck_cards: DeckCardRow[];
}

export const toDeckInput = (d: Pick<DeckWithCards, 'legend_id' | 'champion_id' | 'deck_cards'>): DeckInput => ({
  legendId: d.legend_id,
  championId: d.champion_id,
  entries: d.deck_cards.map((r) => ({ cardId: r.card_id, zone: r.zone, quantity: r.quantity })),
});

export function useDeckList() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['decks', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('decks')
        .select('*, deck_cards(*)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as DeckWithCards[];
    },
  });
}

export function useDeckMutations() {
  const userId = useUserId();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['decks', userId] });

  const create = useMutation({
    mutationFn: async (input: { name: string; legend_id?: string | null; champion_id?: string | null; entries?: DeckEntry[] }) => {
      const { data, error } = await supabase
        .from('decks')
        .insert({ name: input.name, legend_id: input.legend_id ?? null, champion_id: input.champion_id ?? null })
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
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('decks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, remove };
}

type EntryKey = `${string}|${Zone}`;
const ek = (cardId: string, zone: Zone): EntryKey => `${cardId}|${zone}`;

export interface DeckDraft {
  name: string;
  notes: string;
  legendId: string | null;
  championId: string | null;
  entries: DeckEntry[];
}

/**
 * Editable deck. Edits apply to local state immediately and are saved to Supabase
 * after a short pause, sending only what changed.
 */
export function useDeckEditor(deckId: string) {
  const userId = useUserId();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DeckDraft | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saved = useRef<DeckDraft | null>(null);

  const load = useQuery({
    queryKey: ['deck', deckId],
    enabled: !!userId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('decks').select('*, deck_cards(*)').eq('id', deckId).single();
      if (error) throw error;
      return data as DeckWithCards;
    },
  });

  useEffect(() => {
    // Only seed from a fresh fetch, never from a cached copy that predates our last edits.
    if (!load.data || !load.isFetchedAfterMount || saved.current) return;
    const d: DeckDraft = {
      name: load.data.name,
      notes: load.data.notes ?? '',
      legendId: load.data.legend_id,
      championId: load.data.champion_id,
      entries: toDeckInput(load.data).entries,
    };
    saved.current = d;
    setDraft(d);
  }, [load.data, load.isFetchedAfterMount]);

  const save = useCallback(async (next: DeckDraft) => {
    const prev = saved.current;
    if (!prev) return;
    setSaveState('saving');
    try {
      if (
        prev.name !== next.name ||
        prev.notes !== next.notes ||
        prev.legendId !== next.legendId ||
        prev.championId !== next.championId
      ) {
        const { error } = await supabase
          .from('decks')
          .update({ name: next.name, notes: next.notes || null, legend_id: next.legendId, champion_id: next.championId })
          .eq('id', deckId);
        if (error) throw error;
      }
      const before = new Map(prev.entries.map((e) => [ek(e.cardId, e.zone), e.quantity]));
      const after = new Map(next.entries.map((e) => [ek(e.cardId, e.zone), e.quantity]));
      const upserts = next.entries
        .filter((e) => before.get(ek(e.cardId, e.zone)) !== e.quantity)
        .map((e) => ({ deck_id: deckId, card_id: e.cardId, zone: e.zone, quantity: e.quantity }));
      const deletes = prev.entries.filter((e) => !after.has(ek(e.cardId, e.zone)));
      if (upserts.length) {
        const { error } = await supabase.from('deck_cards').upsert(upserts);
        if (error) throw error;
      }
      for (const e of deletes) {
        const { error } = await supabase
          .from('deck_cards')
          .delete()
          .match({ deck_id: deckId, card_id: e.cardId, zone: e.zone });
        if (error) throw error;
      }
      saved.current = next;
      setSaveState('saved');
      setSaveError(null);
      qc.invalidateQueries({ queryKey: ['decks', userId] });
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [deckId, qc, userId]);

  // Saves are queued so they never overlap; each diffs against the last successful save.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((d: DeckDraft) => {
    chain.current = chain.current.then(() => (d === saved.current ? undefined : save(d)));
  }, [save]);

  // Debounced autosave.
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => {
    if (!draft || draft === saved.current) return;
    setSaveState('pending');
    const t = setTimeout(() => enqueue(draft), 700);
    return () => clearTimeout(t);
  }, [draft, enqueue]);

  // Flush unsaved edits when leaving the page.
  useEffect(
    () => () => {
      if (latest.current && latest.current !== saved.current) enqueue(latest.current);
    },
    [enqueue],
  );

  const update = useCallback((fn: (d: DeckDraft) => DeckDraft) => setDraft((d) => (d ? fn(d) : d)), []);

  const setQuantity = useCallback(
    (cardId: string, zone: Zone, quantity: number) =>
      update((d) => {
        const rest = d.entries.filter((e) => !(e.cardId === cardId && e.zone === zone));
        const idx = d.entries.findIndex((e) => e.cardId === cardId && e.zone === zone);
        quantity = Math.min(quantity, maxQuantity(d, cardId, zone, CARDS_BY_ID));
        if (quantity <= 0) return { ...d, entries: rest };
        const entry = { cardId, zone, quantity };
        if (idx === -1) return { ...d, entries: [...d.entries, entry] };
        const entries = [...d.entries];
        entries[idx] = entry;
        return { ...d, entries };
      }),
    [update],
  );

  const add = useCallback(
    (cardId: string, zone: Zone, delta = 1) =>
      update((d) => {
        const cur = d.entries.find((e) => e.cardId === cardId && e.zone === zone)?.quantity ?? 0;
        const q = Math.min(cur + delta, maxQuantity(d, cardId, zone, CARDS_BY_ID));
        if (q === cur) return d;
        const rest = d.entries.filter((e) => !(e.cardId === cardId && e.zone === zone));
        if (q <= 0) return { ...d, entries: rest };
        if (cur === 0) return { ...d, entries: [...d.entries, { cardId, zone, quantity: q }] };
        return { ...d, entries: d.entries.map((e) => (e.cardId === cardId && e.zone === zone ? { ...e, quantity: q } : e)) };
      }),
    [update],
  );

  return {
    draft,
    isLoading: load.isLoading,
    loadError: load.error,
    saveState,
    saveError,
    update,
    add,
    setQuantity,
    retrySave: () => draft && enqueue(draft),
  };
}
