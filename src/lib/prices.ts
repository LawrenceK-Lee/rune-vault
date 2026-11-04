import type { Card } from '../types/card';
import { PRINTINGS } from './cards';

/** One finish (non-foil or foil) of a printing: market and lowest-listing prices in USD. */
export interface FinishPrice {
  m: number | null; // TCGplayer market price
  l: number | null; // lowest current listing
}

/** Price entry per printing (Card.id), as written by scripts/sync-prices.mjs. */
export interface PriceEntry {
  p: number; // TCGplayer productId
  n?: FinishPrice; // normal
  f?: FinishPrice; // foil
}

export interface PriceData {
  source: string;
  currency: 'USD';
  sourceUpdatedAt: string;
  prices: Record<string, PriceEntry>;
}

export const tcgplayerUrl = (productId: number) => `https://www.tcgplayer.com/product/${productId}`;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatPrice = (n: number | null | undefined) => (n == null ? '—' : usd.format(n));

/** Compact form for tiles: $0.25, $12, $1.2k */
export function formatPriceShort(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  if (n >= 100) return `$${Math.round(n)}`;
  return usd.format(n);
}

const finishPrice = (f?: FinishPrice) => f?.m ?? f?.l ?? null;

/** The price to show for a printing: normal finish if sold, otherwise foil. */
export function headlinePrice(entry: PriceEntry | undefined): number | null {
  if (!entry) return null;
  return finishPrice(entry.n) ?? finishPrice(entry.f);
}

/** Cheapest way to get one copy of a card, across all printings and finishes. */
export function cheapestCopy(card: Card, prices: Record<string, PriceEntry>): { price: number; cardId: string } | null {
  let best: { price: number; cardId: string } | null = null;
  for (const c of PRINTINGS.get(card.baseKey) ?? [card]) {
    const e = prices[c.id];
    for (const p of [finishPrice(e?.n), finishPrice(e?.f)])
      if (p != null && (!best || p < best.price)) best = { price: p, cardId: c.id };
  }
  return best;
}
