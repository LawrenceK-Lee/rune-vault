import { useCallback, useMemo, useState } from 'react';
import type { Card } from '../types/card';
import { ALL_CARDS, EMPTY_FILTERS, filterCards, type CardFilters, type SortKey } from '../lib/cards';
import { useCollection } from '../hooks/useCollection';
import { GuestNotice } from '../components/GuestData';
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
  const collection = useCollection();
  const [filters, setFilters] = usePersistentState<CardFilters>('cards.filters', EMPTY_FILTERS);
  const [sort, setSort] = usePersistentState<SortKey>('cards.sort', 'set');
  const [open, setOpen] = useState<Card | null>(null);
  const prices = usePrices();
  const [showPrices, setShowPrices] = usePersistentState('showPrices', true);
  const pricesOn = showPrices && prices.available;

  const cards = useMemo(
    () => filterCards(ALL_CARDS, filters, sort, collection.qty, prices.priceOf),
    [filters, sort, collection.qty, prices.priceOf],
  );
  const close = useCallback(() => setOpen(null), []);

  return (
    <ScrollPage>
      <GuestNotice className="hidden sm:flex" />
      <ErrorNote error={collection.error} />
      <FilterBar filters={filters} onChange={setFilters} sort={sort} onSort={setSort} showOwned resultCount={cards.length} pricesAvailable={prices.available} />
      <PriceBar show={showPrices} onChange={setShowPrices} />
      <CardGrid
        cards={cards}
        renderCard={(c) => (
          <CardTile
            card={c}
            onOpen={setOpen}
            price={pricesOn ? prices.priceOf(c.id) : undefined}
            owned={collection.qty(c.id)}
            onOwnedChange={(n) => collection.setQty(c.id, n)}
          />
        )}
      />
      {open && (
        <CardDetailModal
          card={open}
          onClose={close}
          onSelect={setOpen}
          qty={collection.qty}
          setQty={collection.setQty}
        />
      )}
    </ScrollPage>
  );
}
