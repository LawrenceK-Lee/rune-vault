# Rune Vault

A web app (installable as a PWA) for the Riftbound TCG:

- **Cards**: browse every card and printing (1,400+), with search and filters for domain, type, rarity, set and energy cost.
- **Collection**: track how many copies of each printing you own. Includes set-completion progress, a quick-add mode for logging packs, and an Import / Export menu: import from Excel (.xlsx), CSV or JSON (TCGplayer-style Set + Card Number columns, codes like OGN-066, or card names, with a preview and a choice to add to or replace your counts), and export to CSV or JSON.
- **Decks**: build decks that are checked live against the Constructed rules, or import one by pasting a decklist, and see which cards you still need to get.

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
4. Run [supabase/migrations/0002_accounts.sql](supabase/migrations/0002_accounts.sql) in the SQL Editor too. It adds usernames, a `profiles` table, and sign-in by username.
5. Deploy the username sign-up function (details below).
6. Configure sign-in (details below).

### Accounts and sign-in

People can sign in four ways:
- Google
- Discord
- Email and password
- Username and password

Username accounts don't need an email; the player can connect one later in **Account settings**. Account settings also lets players change their username, email or password, and connect or disconnect Google and Discord.

**1. Deploy the username sign-up function.** Supabase Auth always needs an email address, so a separate Edge Function creates username-only accounts with a private placeholder email.
1. In the dashboard, open **Edge Functions → Deploy a new function → Via Editor**.
2. Name it `create-username-account` and paste in [supabase/functions/create-username-account/index.ts](supabase/functions/create-username-account/index.ts).
3. In the function's settings, turn **off** "Verify JWT", because people calling it aren't signed in yet.

**2. Authentication settings in the Supabase dashboard:**
- **URL Configuration:**
  - Set the **Site URL** to where the app runs, for example `http://localhost:5173`.
  - Add `http://localhost:5173/**` to **Redirect URLs**, plus your deployed site's URL with `/**` later.
- **Sign In / Providers:** turn on **Allow manual linking** so players can connect Google or Discord to an existing account.
- **Emails → Secure email change:** turn this **off**. Username-only accounts have no real email to confirm from, so with it on they could never connect an email. With it off, changing an email only needs confirmation from the new address.

**3. Discord** (about 5 minutes):
1. At [discord.com/developers/applications](https://discord.com/developers/applications), click **New Application** and name it "Rune Vault".
2. Under **OAuth2**, add the redirect `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Copy the **Client ID** and **Client Secret**. You may need to reset the secret to see it.
4. In Supabase, open **Authentication → Sign In / Providers → Discord**. Enable it, paste both values, and save.

**4. Google** (about 10 minutes):
1. In the [Google Cloud Console](https://console.cloud.google.com), create a project.
2. Open **APIs & Services → OAuth consent screen**. Choose **External**, then fill in the app name and support email. Add scopes `email`, `profile` and `openid`.
3. Open **Credentials → Create credentials → OAuth client ID** and choose **Web application**:
   - **Authorized JavaScript origins:** `http://localhost:5173`, plus your deployed URL later.
   - **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Copy the Client ID and Client secret into Supabase under **Authentication → Sign In / Providers → Google**, and enable it.
5. While the consent screen is in "Testing" mode, only accounts you add as test users can sign in. Click **Publish app** to open it to everyone.

The sign-in page only shows the Google and Discord buttons once those providers are enabled in Supabase.

**About sign in by username:** Supabase Auth only signs in by email. For a username, the app calls the database function `email_for_username_login`. That function returns the account's email only if the password is correct, so it never reveals anyone's email address. It also locks a username for 15 minutes after 10 failed attempts.

## Card data

Card data comes from Riot's official card gallery (playriftbound.com/en-us/card-gallery). The page embeds the full card list in its `__NEXT_DATA__` JSON. The data is saved in `src/data/cards.json` and ships with the app.

To refresh it when a new set releases, run:

```bash
npm run sync-cards
```

Card images are loaded from Riot's CDN as resized WebP files, and the service worker caches them for offline use.

## Prices

Card prices are TCGplayer market prices in USD. They come from [TCGCSV](https://tcgcsv.com), a free daily mirror of TCGplayer's catalog, which refreshes at about 20:00 UTC.

The prices live in `public/prices.json`, which is committed to the repo and loaded by the app at runtime. A GitHub Action, [update-prices.yml](.github/workflows/update-prices.yml), runs daily at 21:30 UTC. It runs `scripts/sync-prices.mjs` and commits the file if anything changed. If the site is hosted on Vercel, Netlify or a similar service, that commit triggers a redeploy, so the live site always has the latest prices.

To start a refresh yourself, open the **Actions** tab on GitHub, choose **Update card prices**, then **Run workflow**. To refresh locally, run `npm run sync-prices`, then `git pull` before your next push, because the Action also commits this file.

Following TCGCSV's [usage guidelines](https://tcgcsv.com/docs), the browser never calls TCGCSV directly, and the script identifies itself and waits between requests.

**Currency:** you can choose a display currency in the price bar. The conversion uses that day's European Central Bank reference rate, fetched from [frankfurter.dev](https://frankfurter.dev) along with the prices. You can also type your own exchange rate. These settings are saved per device.

Prices appear in these places:
- A badge on each card tile, which you can turn off with **Show prices**
- Price sorting on the Cards, Collection and deck pages
- Market and lowest-listing prices for each finish in the card details, with a **Buy on TCGplayer** link
- The estimated value of your collection
- A "cost to complete" figure for each deck, using the cheapest printing of each missing card

Wherever prices are shown, a notice explains when they update and when they were last refreshed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production (into `dist/`) |
| `npm run preview` | Serve the production build, including the service worker |
| `npm test` | Run the deck-rule unit tests |
| `npm run sync-cards` | Re-download the card list from Riot's gallery |
| `npm run sync-prices` | Refresh TCGplayer prices and exchange rates (add `-- --force` to re-download even if unchanged) |

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
