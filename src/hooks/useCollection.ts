import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CollectionRow } from '../lib/supabase';
import { CARDS_BY_ID } from '../lib/cards';
import { useDataStore } from './useDataStore';

const key = (scope: string) => ['collection', scope];

export function useCollection() {
  const { store, scope, ready } = useDataStore();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: key(scope),
    queryFn: () => store.listCollection(),
    enabled: ready,
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
    mutationFn: ({ cardId, quantity }: { cardId: string; quantity: number }) => store.setQuantity(cardId, quantity),
    // Optimistic update so +/- feels instant.
    onMutate: async ({ cardId, quantity }) => {
      await qc.cancelQueries({ queryKey: key(scope) });
      const prev = qc.getQueryData<CollectionRow[]>(key(scope));
      const next = (prev ?? []).filter((r) => r.card_id !== cardId);
      if (quantity > 0) next.push({ card_id: cardId, quantity });
      qc.setQueryData(key(scope), next);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key(scope), ctx.prev),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: CollectionRow[]) => {
      const clean = rows.filter((r) => CARDS_BY_ID.has(r.card_id) && r.quantity > 0);
      await store.upsertCollection(clean);
      return clean.length;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key(scope) }),
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
