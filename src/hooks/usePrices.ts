import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { headlinePrice, type PriceData, type PriceEntry } from '../lib/prices';

const EMPTY: Record<string, PriceEntry> = {};
const NO_RATES: Record<string, number> = {};

/** Loads public/prices.json (refreshed daily by the update-prices GitHub Action). Missing file = no prices shown. */
export function usePrices() {
  const q = useQuery({
    queryKey: ['prices'],
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<PriceData | null> => {
      const res = await fetch('/prices.json', { cache: 'no-cache' });
      if (!res.ok) return null;
      try {
        return (await res.json()) as PriceData;
      } catch {
        return null; // e.g. the dev server returned index.html because the file doesn't exist
      }
    },
  });
  const prices = q.data?.prices ?? EMPTY;
  const priceOf = useCallback((id: string) => headlinePrice(prices[id]), [prices]);
  return {
    available: !!q.data,
    prices,
    priceOf,
    updatedAt: q.data?.sourceUpdatedAt ?? null,
    source: q.data?.source ?? null,
    rates: q.data?.rates ?? NO_RATES,
    ratesDate: q.data?.ratesDate ?? null,
  };
}
