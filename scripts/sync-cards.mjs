#!/usr/bin/env node
// Pulls the full Riftbound card list from Riot's official card gallery and writes
// normalized JSON into src/data/. The gallery is a Next.js page that embeds every
// card in its __NEXT_DATA__ script tag, so one GET is enough.
//
// Usage: npm run sync-cards            (fetch live)
//        node scripts/sync-cards.mjs path/to/saved-gallery.html   (parse a local copy)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GALLERY_URL = 'https://playriftbound.com/en-us/card-gallery/';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'src/data');

async function loadHtml() {
  const local = process.argv[2];
  if (local) return readFile(local, 'utf8');
  const res = await fetch(GALLERY_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (rift-unbound card sync)' } });
  if (!res.ok) throw new Error(`Gallery request failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function findCardItems(nextData) {
  const blades = nextData?.props?.pageProps?.page?.blades ?? [];
  for (const blade of blades) {
    const items = blade?.cards?.items;
    if (Array.isArray(items) && items[0]?.publicCode) return items;
  }
  throw new Error('Could not find the card list in __NEXT_DATA__ (page structure may have changed).');
}

const stripHtml = (html) =>
  (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .trim();

const num = (field) => {
  const v = field?.value?.id;
  return typeof v === 'number' ? v : v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null;
};

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Riot's gallery data has errors in some sets (seen in Radiance, Nov 2026): card types and
// domains shuffled between cards, or left blank. The corrections below are checked against
// the printed cards, and each one is counted so the sync log shows when they stop being needed.
const corrections = { type: [], domain: [] };

// The image's accessibility text starts with the printed type ("Riftbound Spell: Scorched Earth")
// and matches the card face even where the cardType field is wrong.
const PRINTED_TYPES = new Set(['unit', 'spell', 'gear', 'battlefield', 'legend', 'rune']);
function printedType(raw) {
  const t = raw.cardImage?.accessibilityText?.match(/^Riftbound ([A-Za-z]+):/)?.[1]?.toLowerCase();
  return PRINTED_TYPES.has(t) ? t : null;
}

// Sets whose single-domain cards are numbered in fixed blocks per domain, in this order. The
// collector number then gives the true domain (verified against every card frame in the set).
const DOMAIN_ORDER = ['fury', 'calm', 'mind', 'body', 'chaos', 'order'];
const DOMAIN_BLOCKS = { RAD: { size: 23, last: 138 } };

function fixDomains(cards) {
  const bases = new Map();
  for (const c of cards) {
    const block = DOMAIN_BLOCKS[c.set];
    if (!block || c.isAltArt || !c.collectorNumber || c.collectorNumber > block.last) continue;
    const domain = DOMAIN_ORDER[Math.floor((c.collectorNumber - 1) / block.size)];
    if (c.domains.length !== 1 || c.domains[0] !== domain) {
      corrections.domain.push(`${c.code} ${c.name}: ${c.domains.join('/') || 'none'} -> ${domain}`);
      c.domains = [domain];
    }
    bases.set(`${c.set}:${c.baseKey}`, c);
  }
  // Alt-art and promo printings share their base card's domains.
  for (const c of cards) {
    const base = c.isAltArt && bases.get(`${c.set}:${c.baseKey}`);
    if (base && base.domains.join() !== c.domains.join()) {
      corrections.domain.push(`${c.code} ${c.name}: ${c.domains.join('/') || 'none'} -> ${base.domains.join('/')}`);
      c.domains = [...base.domains];
    }
  }
}

function normalize(raw) {
  const set = raw.set?.value ?? {};
  const types = (raw.cardType?.type ?? []).map((t) => t.id);
  const printed = printedType(raw);
  if (printed && printed !== types[0]) {
    corrections.type.push(`${raw.publicCode} ${raw.name}: ${types[0] ?? 'none'} -> ${printed}`);
    types[0] = printed;
  }
  const supertypes = (raw.cardType?.superType ?? []).map((t) => t.id);
  const domains = (raw.domain?.values ?? []).map((d) => d.id);
  const tags = raw.tags?.tags ?? [];
  const subtitle = raw.subtitle ?? null;
  const textHtml = raw.text?.richText?.body ?? '';
  const effectHtml = raw.effect?.richText?.body ?? '';

  // publicCode looks like "OGN-066/298", "SFD-227*/221", "RAD-SP1/005", "UNL-T01".
  const code = raw.publicCode.split('/')[0];
  const [, numberPart = ''] = code.split('-');
  const setTotal = Number(raw.publicCode.split('/')[1]) || null;
  const isSigned = numberPart.includes('*');
  const isSpecial = /^[A-Z]/.test(numberPart); // SP1, T01 …
  const isOverNumbered = setTotal != null && raw.collectorNumber > setTotal;
  const isAltArt = raw.rarity?.value?.id === 'showcase' || isOverNumbered || isSpecial;

  return {
    id: raw.id,
    code,
    publicCode: raw.publicCode,
    name: raw.name,
    subtitle,
    // Identity of the card for deck-building purposes: alt arts / signed / promo
    // printings of the same card share a baseKey.
    baseKey: slug(subtitle ? `${raw.name} ${subtitle}` : raw.name),
    set: set.id ?? null,
    setName: set.label ?? null,
    collectorNumber: raw.collectorNumber ?? null,
    type: types[0] ?? null,
    supertypes,
    tags,
    rarity: raw.rarity?.value?.id ?? null,
    domains,
    energy: num(raw.energy),
    power: num(raw.power),
    might: num(raw.might),
    mightBonus: num(raw.mightBonus),
    text: stripHtml(textHtml),

    effect: stripHtml(effectHtml) || null,
    imageUrl: raw.cardImage?.url ?? null,
    illustrator: (raw.illustrator?.values ?? []).map((v) => v.label).join(', ') || null,
    orientation: raw.orientation ?? 'portrait',
    isAltArt: isAltArt || isSigned,
    isSigned,
  };
}

const SET_ORDER = ['OGN', 'OGS', 'SFD', 'UNL', 'VEN', 'RAD'];

async function main() {
  const html = await loadHtml();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('No __NEXT_DATA__ script tag found in the gallery page.');
  const items = findCardItems(JSON.parse(match[1]));

  const cards = items.map(normalize);
  fixDomains(cards);
  for (const [kind, list] of Object.entries(corrections)) {
    if (!list.length) continue;
    console.log(`Corrected ${list.length} card ${kind}(s) that Riot's data has wrong:`);
    for (const line of list) console.log(`  ${line}`);
  }
  const setRank = (s) => {
    const i = SET_ORDER.indexOf(s);
    return i === -1 ? SET_ORDER.length : i;
  };
  cards.sort(
    (a, b) =>
      setRank(a.set) - setRank(b.set) ||
      (a.set ?? '').localeCompare(b.set ?? '') ||
      a.code.localeCompare(b.code, undefined, { numeric: true }),
  );

  const sets = new Map();
  for (const c of cards) {
    if (!c.set) continue;
    const s = sets.get(c.set) ?? { id: c.set, name: c.setName, cardCount: 0, baseCount: 0 };
    s.cardCount++;
    if (!c.isAltArt) s.baseCount++;
    sets.set(c.set, s);
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'cards.json'), JSON.stringify(cards));
  await writeFile(
    resolve(outDir, 'sets.json'),
    JSON.stringify({ syncedAt: new Date().toISOString(), sets: [...sets.values()] }, null, 2),
  );
  console.log(`Wrote ${cards.length} cards across ${sets.size} sets to src/data/`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
