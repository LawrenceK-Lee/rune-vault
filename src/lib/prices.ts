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
  syncedAt?: string;
  /** Units of each currency per 1 USD (European Central Bank reference rates). */
  rates?: Record<string, number>;
  ratesDate?: string | null;
  prices: Record<string, PriceEntry>;
}

/** When TCGCSV publishes new TCGplayer prices, and when our GitHub Action picks them up (UTC). */
export const PRICE_SOURCE_REFRESH_UTC = { hour: 20, minute: 0 };
export const PRICE_SYNC_UTC = { hour: 21, minute: 30 };

/** Today's occurrence of a UTC time, shown in the viewer's local time zone, e.g. "8:30 am". */
export function localTimeOfUtc({ hour, minute }: { hour: number; minute: number }) {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const tcgplayerUrl = (productId: number) => `https://www.tcgplayer.com/product/${productId}`;

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
