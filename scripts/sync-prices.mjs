#!/usr/bin/env node
// Downloads current TCGplayer prices (USD) for every Riftbound card from TCGCSV
// (https://tcgcsv.com, a free daily mirror of TCGplayer's catalog) and writes
// public/prices.json, which the app loads at runtime.
//
// TCGCSV usage rules we follow (https://tcgcsv.com/docs):
//   - identify ourselves with a "AppName/X.Y.Z" User-Agent
//   - data changes once a day: check last-updated.txt and skip if nothing is new
//   - sleep 100ms between requests; never call TCGCSV from the browser
//
// Usage: npm run sync-prices            (skips if already up to date)
//        npm run sync-prices -- --force
//        npm run sync-prices -- --soft   (never fail; keep the existing file on errors)
//
// In production this runs daily from .github/workflows/update-prices.yml, which
// commits the refreshed public/prices.json so the hosted site redeploys.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, 'public/prices.json');
const cardsFile = resolve(root, 'src/data/cards.json');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

const BASE = 'https://tcgcsv.com';
const CATEGORY = 89; // Riftbound: League of Legends Trading Card Game
const HEADERS = { 'User-Agent': `RiftUnbound/${pkg.version}` };
const force = process.argv.includes('--force');
const soft = process.argv.includes('--soft');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, as = 'json') {
  await sleep(100);
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

/** USD exchange rates from the European Central Bank (via frankfurter.dev, free, no key). */
async function fetchRates(previous) {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD', { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { rates: data.rates, ratesDate: data.date };
  } catch (err) {
    console.warn(`Exchange rates unavailable (${err.message}); keeping previous rates.`);
    return { rates: previous?.rates ?? {}, ratesDate: previous?.ratesDate ?? null };
  }
}

const round = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : null);

async function main() {
  const lastUpdated = (await get('/last-updated.txt', 'text')).trim();

  let existing = null;
  try {
    existing = JSON.parse(await readFile(outFile, 'utf8'));
  } catch {
    /* first run */
  }
  if (!force && existing?.sourceUpdatedAt === lastUpdated) {
    console.log(`Prices already up to date (TCGCSV ${lastUpdated}).`);
    return;
  }

  const cards = JSON.parse(await readFile(cardsFile, 'utf8'));
  const cardByCode = new Map(cards.map((c) => [c.code.toUpperCase(), c]));
  const ourSets = new Set(cards.map((c) => c.set));

  const groups = (await get(`/tcgplayer/${CATEGORY}/groups`)).results.filter((g) => ourSets.has(g.abbreviation));

  const prices = {};
  for (const g of groups) {
    const products = (await get(`/tcgplayer/${CATEGORY}/${g.groupId}/products`)).results;
    const priceRows = (await get(`/tcgplayer/${CATEGORY}/${g.groupId}/prices`)).results;

    const cardByProduct = new Map();
    for (const p of products) {
      const number = p.extendedData?.find((e) => e.name === 'Number')?.value;
      if (!number) continue; // sealed product, not a single card
      const card = cardByCode.get(`${g.abbreviation}-${number.split('/')[0]}`.toUpperCase());
      if (card) cardByProduct.set(p.productId, card);
    }

    for (const row of priceRows) {
      const card = cardByProduct.get(row.productId);
      if (!card) continue;
      const entry = (prices[card.id] ??= { p: row.productId });
      const kind = row.subTypeName === 'Foil' ? 'f' : 'n';
      const market = round(row.marketPrice);
      const low = round(row.lowPrice);
      if (market != null || low != null) entry[kind] = { m: market, l: low };
    }
  }

  const { rates, ratesDate } = await fetchRates(existing);

  const priced = Object.values(prices).filter((e) => e.n || e.f).length;
  if (priced < cards.length * 0.5) throw new Error(`Only ${priced} cards priced; refusing to overwrite prices.json.`);

  await writeFile(
    outFile,
    JSON.stringify({
      source: 'TCGplayer via TCGCSV',
      currency: 'USD',
      sourceUpdatedAt: lastUpdated,
      syncedAt: new Date().toISOString(),
      rates,
      ratesDate,
      prices,
    }),
  );
  console.log(`Wrote prices for ${priced} of ${cards.length} printings (TCGCSV ${lastUpdated}).`);
}

main().catch((err) => {
  console.error(`Price sync failed: ${err.message}`);
  if (soft) console.error('Continuing with existing prices.json (if any).');
  process.exit(soft ? 0 : 1);
});
