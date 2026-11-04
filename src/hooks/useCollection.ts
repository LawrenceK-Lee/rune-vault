import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type CollectionRow } from '../lib/supabase';
import { CARDS_BY_ID } from '../lib/cards';
import { useUserId } from './useAuth';

const key = (userId: string | null) => ['collection', userId];

async function fetchCollection(): Promise<CollectionRow[]> {
  // Page through in case a collection grows past the default 1000-row limit.
  const rows: CollectionRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('collection_items')
      .select('card_id, quantity')
      .gt('quantity', 0)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

export function useCollection() {
  const userId = useUserId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: key(userId),
    queryFn: fetchCollection,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const byId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of query.data ?? []) m.set(r.card_id, r.quantity);
    return m;
  }, [query.data]);

  const byBaseKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const [id, q] of byId) {
      const c = CARDS_BY_ID.get(id);
      if (c) m.set(c.baseKey, (m.get(c.baseKey) ?? 0) + q);
    }
    return m;
  }, [byId]);

  const setMutation = useMutation({
    // Run collection writes one at a time so rapid +/- clicks land in order.
    scope: { id: 'collection-write' },
    mutationFn: async ({ cardId, quantity }: { cardId: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase.from('collection_items').delete().eq('card_id', cardId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('collection_items')
          .upsert({ user_id: userId, card_id: cardId, quantity, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    // Optimistic update so +/- feels instant.
    onMutate: async ({ cardId, quantity }) => {
      await qc.cancelQueries({ queryKey: key(userId) });
      const prev = qc.getQueryData<CollectionRow[]>(key(userId));
      const next = (prev ?? []).filter((r) => r.card_id !== cardId);
      if (quantity > 0) next.push({ card_id: cardId, quantity });
      qc.setQueryData(key(userId), next);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key(userId), ctx.prev),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: CollectionRow[]) => {
      const clean = rows.filter((r) => CARDS_BY_ID.has(r.card_id) && r.quantity > 0);
      for (let i = 0; i < clean.length; i += 500) {
        const { error } = await supabase
          .from('collection_items')
          .upsert(clean.slice(i, i + 500).map((r) => ({ ...r, user_id: userId })));
        if (error) throw error;
      }
      return clean.length;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key(userId) }),
  });

  const qty = useCallback((id: string) => byId.get(id) ?? 0, [byId]);
  const qtyBase = useCallback((k: string) => byBaseKey.get(k) ?? 0, [byBaseKey]);
  const setQty = useCallback(
    (cardId: string, quantity: number) => setMutation.mutate({ cardId, quantity: Math.max(0, quantity) }),
    [setMutation],
  );

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? setMutation.error,
    qty,
    qtyBase,
    setQty,
    importRows: importMutation.mutateAsync,
    importing: importMutation.isPending,
  };
}
