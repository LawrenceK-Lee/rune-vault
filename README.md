# Rift Unbound

A web app (installable as a PWA) for the Riftbound TCG:

- **Cards**: browse every card and printing (1,400+), with search and filters for domain, type, rarity, set and energy cost.
- **Collection**: track how many copies of each printing you own. Includes set-completion progress, a quick-add mode for logging packs, and CSV/JSON export plus JSON import.
- **Decks**: build decks that are checked live against the Constructed rules, and see which cards you still need to get.

Browsing cards works with no setup. The collection and decks need a free Supabase project.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values (see below)
npm run dev                  # http://localhost:5173
```

### Supabase (accounts + cloud storage)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql), and run it. This creates the `collection_items`, `decks` and `deck_cards` tables, with row-level security so each user only sees their own data.
3. In **Project Settings → API Keys**, copy the **publishable** key (`sb_publishable_...`), and copy the Project URL from **Project Settings → Data API**. Put both in `.env.local`. Never use the **secret** key (`sb_secret_...`) in this app: anything in a `VITE_` variable is shipped to every visitor's browser.
4. Optional: under **Authentication → URL Configuration**, add your site URL (for example `http://localhost:5173`) so email confirmation and magic links redirect correctly. If you want sign-up to work without email confirmation while developing, turn off "Confirm email" under **Authentication → Providers → Email**.

## Card data

Card data comes from Riot's official card gallery (playriftbound.com/en-us/card-gallery). The page embeds the full card list in its `__NEXT_DATA__` JSON. The data is saved in `src/data/cards.json` and ships with the app.

To refresh it when a new set releases, run:

```bash
npm run sync-cards
```

Card images are loaded from Riot's CDN as resized WebP files, and the service worker caches them for offline use.

## Prices

Card prices are TCGplayer market prices in USD. They come from [TCGCSV](https://tcgcsv.com), a free daily mirror of TCGplayer's catalog, and update once a day at about 20:00 UTC.

`scripts/sync-prices.mjs` downloads them into `public/prices.json`, which the app loads at runtime. That file is generated, so it isn't committed to Git. The script runs automatically before `npm run dev` and `npm run build`. It skips the download when nothing has changed, and if the download fails, the app keeps its existing prices.

Following TCGCSV's [usage guidelines](https://tcgcsv.com/docs), the browser never calls TCGCSV directly, and the script identifies itself and waits between requests.

Prices appear in these places:
- A badge on each card tile, which you can turn off with **Show prices**
- Price sorting on the Cards and Collection pages
- Market and lowest-listing prices for each finish in the card details, with a **Buy on TCGplayer** link
- The estimated value of your collection
- A "cost to complete" figure for each deck, using the cheapest printing of each missing card

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production (into `dist/`) |
| `npm run preview` | Serve the production build, including the service worker |
| `npm test` | Run the deck-rule unit tests |
| `npm run sync-cards` | Re-download the card list from Riot's gallery |
| `npm run sync-prices` | Refresh TCGplayer prices (add `-- --force` to re-download even if unchanged) |

## Deck rules enforced

The rules live in [src/lib/deckRules.ts](src/lib/deckRules.ts). The `RULES` constants at the top of that file are easy to adjust.

- One Legend and one Chosen Champion. The champion must be a champion unit that shares the Legend's champion tag.
- A main deck of at least 40 cards, including the Chosen Champion. Tournament mode requires exactly 40.
- At most 3 copies of a card across the main deck and sideboard. Alt-art and reprint copies count toward the same limit.
- Every card must be within the Legend's domains (colorless cards are always allowed).
- Exactly 12 runes, and exactly 3 battlefields with different names.
- At most 3 Signature cards, and they must belong to the Legend's champion.
- Sideboard of up to 8 cards. This one only shows a warning, because sources disagree on the limit.

Rule problems appear as warnings in the editor and never block saving.

## Project layout

```
scripts/sync-cards.mjs     card data sync from Riot's gallery
supabase/migrations/       database schema + RLS policies
src/data/                  generated card + set JSON
src/lib/cards.ts           card catalog, indexes, search/filter
src/lib/deckRules.ts       deck validation + missing-card calculation (pure, tested)
src/hooks/                 auth, collection, decks (Supabase + react-query)
src/pages/                 Cards, Collection, Decks, DeckEditor, Login
src/components/            card grid/tile/detail modal, filters, small UI bits
```

---

Unofficial fan project, not affiliated with or endorsed by Riot Games. Riftbound and all card names, text and artwork are © Riot Games. Please keep this project non-commercial.
