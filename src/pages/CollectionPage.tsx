import { useCallback, useMemo, useRef, useState } from 'react';
import type { Card } from '../types/card';
import { ALL_CARDS, CARDS_BY_ID, EMPTY_FILTERS, SETS, displayName, filterCards, type CardFilters, type SortKey } from '../lib/cards';
import { useCollection } from '../hooks/useCollection';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePrices } from '../hooks/usePrices';
import { useMoney } from '../hooks/useMoney';
import { PriceBar } from '../components/PriceBar';
import { ScrollPage } from '../components/ScrollPage';
import { downloadFile } from '../lib/ui';
import { FilterBar } from '../components/FilterBar';
import { CardGrid } from '../components/CardGrid';
import { CardTile } from '../components/CardTile';
import { CardDetailModal } from '../components/CardDetailModal';
import { ErrorNote, Spinner } from '../components/bits';
import { Menu } from '../components/Menu';
import { ImportCollectionModal, type ImportMode } from '../components/ImportCollectionModal';
import type { ParsedCollection } from '../lib/collectionImport';

const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function CollectionPage() {
  const col = useCollection();
  const [quickAdd, setQuickAdd] = useState(false);
  const [filters, setFilters] = usePersistentState<CardFilters>('collection.filters', { ...EMPTY_FILTERS, owned: 'owned', showVariants: true });
  const [sort, setSort] = usePersistentState<SortKey>('collection.sort', 'set');
  const [open, setOpen] = useState<Card | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const prices = usePrices();
  const { format: formatPrice } = useMoney();
  const [showPrices, setShowPrices] = usePersistentState('showPrices', true);
  const pricesOn = showPrices && prices.available;
  const [importing, setImporting] = useState(false);
  const closeImport = useCallback(() => setImporting(false), []);

  // Quick add searches every card (owned or not) so new pulls can be logged fast.
  const effective = useMemo(() => (quickAdd ? { ...filters, owned: 'all' as const } : filters), [quickAdd, filters]);
  const cards = useMemo(() => filterCards(ALL_CARDS, effective, sort, col.qty, prices.priceOf), [effective, sort, col.qty, prices.priceOf]);

  const stats = useMemo(() => {
    let total = 0;
    let value = 0;
    let unpriced = 0;
    for (const r of col.rows) {
      total += r.quantity;
      const p = prices.priceOf(r.card_id);
      if (p == null) unpriced += r.quantity;
      else value += p * r.quantity;
    }
    const perSet = SETS.map((s) => {
      const base = new Set<string>();
      const ownedBase = new Set<string>();
      let printings = 0;
      for (const c of ALL_CARDS) {
        if (c.set !== s.id || c.supertypes.includes('token')) continue;
        base.add(c.baseKey);
        if (col.qty(c.id) > 0) {
          ownedBase.add(c.baseKey);
          printings++;
        }
      }
      return { ...s, unique: base.size, ownedUnique: ownedBase.size, ownedPrintings: printings };
    });
    return { total, distinct: col.rows.length, perSet, value, unpriced };
  }, [col.rows, col.qty, prices.priceOf]);

  const close = useCallback(() => setOpen(null), []);

  function exportJson() {
    const data = col.rows.map((r) => ({ ...r, code: CARDS_BY_ID.get(r.card_id)?.publicCode, name: CARDS_BY_ID.get(r.card_id)?.name }));
    downloadFile(`riftbound-collection-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
  }
  function exportCsv() {
    const lines = [['code', 'name', 'set', 'rarity', 'quantity', 'card_id'].join(',')];
    for (const r of col.rows) {
      const c = CARDS_BY_ID.get(r.card_id);
      if (!c) continue;
      lines.push([c.publicCode, displayName(c), c.setName ?? '', c.rarity ?? '', r.quantity, c.id].map(csvCell).join(','));
    }
    downloadFile(`riftbound-collection-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
  }
  async function runImport(parsed: ParsedCollection, mode: ImportMode) {
    const rows = parsed.items.map(({ card, quantity }) => ({ card_id: card.id, quantity: mode === 'add' ? col.qty(card.id) + quantity : quantity }));
    const n = await col.importRows(rows);
    setImporting(false);
    setMessage(
      `Imported ${n.toLocaleString()} cards (${parsed.copies.toLocaleString()} copies) — ${mode === 'add' ? 'added to your collection' : 'counts replaced'}.` +
        (parsed.unknown.length ? ` ${parsed.unknown.length} row(s) weren't recognised and were skipped.` : ''),
    );
  }

  // In quick-add mode, Enter adds one copy of the top search result.
  function addTopResult() {
    const top = cards[0];
    if (!top || !filters.query) return;
    col.setQty(top.id, col.qty(top.id) + 1);
    setMessage(`+1 ${displayName(top)} (${top.publicCode}) — now ${col.qty(top.id) + 1}`);
    setFilters({ ...filters, query: '' });
    searchRef.current?.focus();
  }

  if (col.isLoading) return <Spinner label="Loading your collection…" />;

  return (
    <ScrollPage>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading text-2xl">My Collection</h1>
          <p className="text-sm text-slate-400">
            {stats.total.toLocaleString()} cards · {stats.distinct.toLocaleString()} different printings
            {prices.available && stats.total > 0 && (
              <span title={`Sum of TCGplayer market prices${stats.unpriced ? `; ${stats.unpriced} card(s) have no price` : ''}`}>
                {' · '}est. value <b className="text-emerald-300">{formatPrice(stats.value)}</b>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={quickAdd ? 'btn-primary' : 'btn-ghost'} onClick={() => { setQuickAdd((q) => !q); setTimeout(() => searchRef.current?.focus()); }}>
            {quickAdd ? 'Quick add: on' : 'Quick add'}
          </button>
          <Menu
            label="Import / Export"
            sections={[
              {
                title: 'Import',
                items: [{ label: 'Import from file…', hint: 'Excel (.xlsx), CSV or JSON', onSelect: () => { setMessage(null); setImporting(true); } }],
              },
              {
                title: 'Export',
                items: [
                  { label: 'Export as CSV', hint: 'Opens in Excel or Google Sheets', onSelect: exportCsv, disabled: !col.rows.length },
                  { label: 'Export as JSON', hint: 'Full backup you can import here later', onSelect: exportJson, disabled: !col.rows.length },
                ],
              },
            ]}
          />
        </div>
      </div>

      <ErrorNote error={col.error} />
      {message && <div className="shrink-0 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-200">{message}</div>}
      {quickAdd && (
        <p className="shrink-0 text-sm text-gold-300">
          Quick add: type a card name or code and press <kbd className="rounded bg-ink-700 px-1.5">Enter</kbd> to add one copy of the top result.
        </p>
      )}

      <FilterBar
        filters={effective}
        onChange={setFilters}
        sort={sort}
        onSort={setSort}
        showOwned={!quickAdd}
        resultCount={cards.length}
        pricesAvailable={prices.available}
        searchRef={searchRef}
        onSearchEnter={quickAdd ? addTopResult : undefined}
      />

      <PriceBar show={showPrices} onChange={setShowPrices} />

      <CardGrid
        cards={cards}
        empty={stats.distinct ? 'No cards match these filters.' : 'Your collection is empty. Use Quick add, or add cards from the Cards page.'}
        header={
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.perSet.map((s) => {
              const pct = s.unique ? Math.round((s.ownedUnique / s.unique) * 100) : 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFilters({ ...filters, sets: filters.sets.length === 1 && filters.sets[0] === s.id ? [] : [s.id] })}
                  className={`panel p-3 text-left transition-colors hover:border-gold-400/50 ${filters.sets.length === 1 && filters.sets[0] === s.id ? 'border-gold-400/70' : ''}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-sm tabular-nums text-gold-300">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full bg-gold-400" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 tabular-nums">
                    {s.ownedUnique}/{s.unique} cards · {s.ownedPrintings}/{s.cardCount} printings incl. alt arts
                  </p>
                </button>
              );
            })}
          </div>
        }
        renderCard={(c) => <CardTile card={c} onOpen={setOpen} price={pricesOn ? prices.priceOf(c.id) : undefined} owned={col.qty(c.id)} onOwnedChange={(n) => col.setQty(c.id, n)} />}
      />

      {open && <CardDetailModal card={open} onClose={close} onSelect={setOpen} qty={col.qty} setQty={col.setQty} />}
      {importing && <ImportCollectionModal onClose={closeImport} onImport={runImport} busy={col.importing} owned={col.qty} />}
    </ScrollPage>
  );
}
