import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Card } from '../types/card';
import { ALL_CARDS, EMPTY_FILTERS, filterCards, type CardFilters, type SortKey } from '../lib/cards';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabaseConfigured } from '../lib/supabase';
import { FilterBar } from '../components/FilterBar';
import { CardGrid } from '../components/CardGrid';
import { CardTile } from '../components/CardTile';
import { CardDetailModal } from '../components/CardDetailModal';
import { ErrorNote } from '../components/bits';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePrices } from '../hooks/usePrices';
import { PriceBar } from '../components/PriceBar';
import { ScrollPage } from '../components/ScrollPage';

export function CardsPage() {
  const { session } = useAuth();
  const signedIn = !!session;
  const collection = useCollection();
  const [filters, setFilters] = usePersistentState<CardFilters>('cards.filters', EMPTY_FILTERS);
  const [sort, setSort] = usePersistentState<SortKey>('cards.sort', 'set');
  const [open, setOpen] = useState<Card | null>(null);
  const prices = usePrices();
  const [showPrices, setShowPrices] = usePersistentState('showPrices', true);
  const pricesOn = showPrices && prices.available;

  const cards = useMemo(
    () => filterCards(ALL_CARDS, filters, sort, signedIn ? collection.qty : undefined, prices.priceOf),
    [filters, sort, signedIn, collection.qty, prices.priceOf],
  );
  const close = useCallback(() => setOpen(null), []);

  return (
    <ScrollPage>
      {!signedIn && supabaseConfigured && (
        <div className="panel hidden shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-slate-300 sm:flex">
          <span>Sign in to track which cards you own and build decks.</span>
          <Link to="/login" className="btn-primary">Sign in</Link>
        </div>
      )}
      <ErrorNote error={collection.error} />
      <FilterBar filters={filters} onChange={setFilters} sort={sort} onSort={setSort} showOwned={signedIn} resultCount={cards.length} pricesAvailable={prices.available} />
      <PriceBar show={showPrices} onChange={setShowPrices} />
      <CardGrid
        cards={cards}
        renderCard={(c) => (
          <CardTile
            card={c}
            onOpen={setOpen}
            price={pricesOn ? prices.priceOf(c.id) : undefined}
            owned={signedIn ? collection.qty(c.id) : undefined}
            onOwnedChange={signedIn ? (n) => collection.setQty(c.id, n) : undefined}
          />
        )}
      />
      {open && (
        <CardDetailModal
          card={open}
          onClose={close}
          onSelect={setOpen}
          qty={signedIn ? collection.qty : undefined}
          setQty={signedIn ? collection.setQty : undefined}
        />
      )}
    </ScrollPage>
  );
}
