import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { DOMAINS, type Card, type Domain } from '../types/card';
import {
  ALL_CARDS,
  CARDS_BY_ID,
  EMPTY_FILTERS,
  UNIQUE_CARDS,
  displayName,
  filterCards,
  isToken,
  legendChampion,
  type CardFilters,
  type SortKey,
} from '../lib/cards';
import { RULES, defaultZone, fitsDomains, missingCards, validateDeck, type DeckEntry, type Zone } from '../lib/deckRules';
import { cap, cardImage } from '../lib/ui';
import { useDeckEditor, type DeckDraft } from '../hooks/useDecks';
import { useCollection } from '../hooks/useCollection';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePrices } from '../hooks/usePrices';
import { cheapestCopy } from '../lib/prices';
import { useMoney } from '../hooks/useMoney';
import { FilterBar } from '../components/FilterBar';
import { CardGrid } from '../components/CardGrid';
import { CardTile } from '../components/CardTile';
import { CardDetailModal } from '../components/CardDetailModal';
import { DomainDots, ErrorNote, QuantityStepper, Spinner } from '../components/bits';
import { PriceBar } from '../components/PriceBar';

const ZONE_LABEL: Record<Zone, string> = { main: 'Main deck', rune: 'Runes', battlefield: 'Battlefields', sideboard: 'Sideboard' };
const TYPE_ORDER = ['unit', 'spell', 'gear'];

function deckText(d: DeckDraft) {
  const name = (id: string | null) => (id && CARDS_BY_ID.get(id) ? displayName(CARDS_BY_ID.get(id)!) : '—');
  const lines = [`# ${d.name}`, `Legend: ${name(d.legendId)}`, `Champion: ${name(d.championId)}`];
  for (const zone of ['main', 'rune', 'battlefield', 'sideboard'] as Zone[]) {
    const es = d.entries.filter((e) => e.zone === zone && CARDS_BY_ID.has(e.cardId));
    if (!es.length) continue;
    lines.push('', `${ZONE_LABEL[zone]}:`);
    for (const e of es) lines.push(`${e.quantity} ${name(e.cardId)} (${CARDS_BY_ID.get(e.cardId)!.publicCode})`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- legend picker
function LegendPicker({ onPick, current }: { onPick: (c: Card) => void; current: string | null }) {
  const [q, setQ] = useState('');
  const legends = useMemo(() => {
    const needle = q.toLowerCase();
    return UNIQUE_CARDS.filter(
      (c) => c.type === 'legend' && (!needle || `${c.name} ${c.tags.join(' ')} ${c.domains.join(' ')}`.toLowerCase().includes(needle)),
    ).sort((a, b) => (legendChampion(a) ?? '').localeCompare(legendChampion(b) ?? ''));
  }, [q]);
  return (
    <div className="space-y-3">
      <input type="search" placeholder="Search legends by champion, name or domain…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full" autoFocus />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
        {legends.map((l) => (
          <button key={l.id} type="button" onClick={() => onPick(l)} className={`text-left ${current === l.id ? 'ring-2 ring-gold-400 rounded-lg' : ''}`}>
            <img src={cardImage(l)} alt={displayName(l)} loading="lazy" className="w-full rounded-[4.5%/3.3%] ring-1 ring-ink-700 hover:ring-gold-400/60" style={{ aspectRatio: '744 / 1039' }} />
            <span className="mt-1 block truncate text-sm font-medium">{legendChampion(l)}</span>
            <span className="block truncate text-xs text-slate-400">{l.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- deck list (right side)
function DeckRow({
  card,
  quantity,
  owned,
  needed,
  flagged,
  onChange,
  onOpen,
  max,
}: {
  card: Card;
  quantity: number;
  owned: number;
  needed: number;
  flagged: boolean;
  onChange: (n: number) => void;
  onOpen: () => void;
  max?: number;
}) {
  const short = owned < needed;
  return (
    <li className={`flex items-center gap-2 py-1 pl-2 pr-1 ${flagged ? 'bg-red-950/40' : ''}`}>
      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-slate-400">{card.energy ?? ''}</span>
      <DomainDots domains={card.domains} size={8} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-sm hover:text-gold-300" title={card.publicCode}>
        {displayName(card)}
      </button>
      <span
        className={`shrink-0 rounded px-1.5 text-[11px] tabular-nums ${short ? 'bg-red-900/50 text-red-200' : 'text-emerald-300/80'}`}
        title={`You own ${owned} (all printings); this deck uses ${needed}`}
      >
        {owned}/{needed}
      </span>
      <QuantityStepper size="sm" value={quantity} onChange={onChange} max={max} />
    </li>
  );
}

// ---------------------------------------------------------------- page
export function DeckEditorPage() {
  const { deckId = '' } = useParams();
  const ed = useDeckEditor(deckId);
  const col = useCollection();
  const [tournament, setTournament] = usePersistentState('deck.tournament', true);
  const [tab, setTab] = useState<'add' | 'deck'>('add');
  const [pickingLegend, setPickingLegend] = useState(false);
  const [legalOnly, setLegalOnly] = usePersistentState('deck.legalOnly', true);
  const [filters, setFilters] = usePersistentState<CardFilters>('deck.filters', EMPTY_FILTERS);
  const [sort, setSort] = usePersistentState<SortKey>('deck.sort', 'energy');
  const [open, setOpen] = useState<Card | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const prices = usePrices();
  const { format: formatPrice } = useMoney();
  const [showPrices, setShowPrices] = usePersistentState('showPrices', true);

  const draft = ed.draft;
  const legend = draft?.legendId ? CARDS_BY_ID.get(draft.legendId) ?? null : null;
  const champion = draft?.championId ? CARDS_BY_ID.get(draft.championId) ?? null : null;
  const tag = legend ? legendChampion(legend) : null;

  const deckInput = useMemo(
    () => (draft ? { legendId: draft.legendId, championId: draft.championId, entries: draft.entries } : null),
    [draft],
  );
  const summary = useMemo(() => (deckInput ? validateDeck(deckInput, CARDS_BY_ID, { tournament }) : null), [deckInput, tournament]);
  const missing = useMemo(() => (deckInput ? missingCards(deckInput, CARDS_BY_ID, col.qtyBase) : []), [deckInput, col.qtyBase]);
  const needByBase = useMemo(() => new Map(missing.map((l) => [l.baseKey, l])), [missing]);
  const flagged = useMemo(() => new Set(summary?.issues.flatMap((i) => i.cardIds ?? []) ?? []), [summary]);

  // With a Legend chosen (and "legal only" on), only that Legend's domains + colorless are offered.
  const domainOptions = useMemo<Domain[]>(
    () => (legalOnly && legend ? [...legend.domains.filter((d) => d !== 'colorless'), 'colorless'] : DOMAINS),
    [legalOnly, legend],
  );

  const pool = useMemo(() => {
    let base = ALL_CARDS.filter((c) => !isToken(c) && c.type !== 'legend');
    if (legalOnly && legend) base = base.filter((c) => fitsDomains(c, legend) && (!c.supertypes.includes('signature') || (tag != null && c.tags.includes(tag))));
    // Ignore any remembered domain chips that aren't offered for this Legend.
    const effective = { ...filters, domains: filters.domains.filter((d) => domainOptions.includes(d)) };
    return filterCards(base, effective, sort, col.qty, prices.priceOf);
  }, [legalOnly, legend, tag, filters, domainOptions, sort, col.qty, prices.priceOf]);

  const inDeck = useCallback(
    (id: string, zone: Zone) => draft?.entries.find((e) => e.cardId === id && e.zone === zone)?.quantity ?? 0,
    [draft],
  );

  const close = useCallback(() => setOpen(null), []);

  if (ed.isLoading || (!draft && !ed.loadError)) return <Spinner label="Loading deck…" />;
  if (ed.loadError || !draft || !summary)
    return (
      <div className="space-y-3">
        <ErrorNote error={ed.loadError ?? 'Deck not found.'} />
        <Link to="/decks" className="btn-ghost">← Back to decks</Link>
      </div>
    );

  const setLegend = (c: Card) => {
    ed.update((d) => {
      const keepChamp = d.championId && CARDS_BY_ID.get(d.championId)?.tags.includes(legendChampion(c) ?? '');
      return { ...d, legendId: c.id, championId: keepChamp ? d.championId : null };
    });
    setPickingLegend(false);
  };
  const isChampionOption = (c: Card) => c.type === 'unit' && c.supertypes.includes('champion') && (!tag || c.tags.includes(tag));

  const ownedFor = (c: Card) => col.qtyBase(c.baseKey);
  const neededFor = (c: Card) => needByBase.get(c.baseKey)?.needed ?? 0;
  const totalMissing = missing.reduce((n, l) => n + l.missing, 0);
  const missingCost = missing.map((l) => {
    const best = l.missing ? cheapestCopy(l.card, prices.prices) : null;
    return { ...l, unit: best?.price ?? null };
  });
  const costToComplete = missingCost.reduce((sum, l) => sum + (l.unit ?? 0) * l.missing, 0);
  const unpricedMissing = missingCost.filter((l) => l.missing && l.unit == null).length;

  const copyText = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied('Copy failed — your browser blocked clipboard access.');
    }
  };

  const zoneEntries = (zone: Zone) =>
    draft.entries
      .filter((e) => e.zone === zone && CARDS_BY_ID.has(e.cardId))
      .map((e) => ({ e, c: CARDS_BY_ID.get(e.cardId)! }))
      .sort(
        (a, b) =>
          TYPE_ORDER.indexOf(a.c.type ?? '') - TYPE_ORDER.indexOf(b.c.type ?? '') ||
          (a.c.energy ?? 99) - (b.c.energy ?? 99) ||
          displayName(a.c).localeCompare(displayName(b.c)),
      );

  const zoneCount: Record<Zone, number> = {
    main: summary.mainCount,
    rune: summary.runeCount,
    battlefield: summary.battlefieldCount,
    sideboard: summary.sideboardCount,
  };
  const zoneTarget: Record<Zone, string> = {
    main: tournament ? `${RULES.tournamentMainDeckSize}` : `${RULES.mainDeckMin}+`,
    rune: `${RULES.runeCount}`,
    battlefield: `${RULES.battlefieldCount}`,
    sideboard: `≤${RULES.sideboardMax}`,
  };

  // ---------------- add-cards panel
  const addPanel = pickingLegend || !legend ? (
    <div className="space-y-3">
      <h2 className="heading text-lg">{legend ? 'Change Legend' : 'Step 1 · Choose your Legend'}</h2>
      {legend && <button type="button" className="btn-ghost" onClick={() => setPickingLegend(false)}>Cancel</button>}
      <LegendPicker onPick={setLegend} current={draft.legendId} />
    </div>
  ) : (
    <div className="space-y-3">
      {!champion && (
        <div className="rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm text-gold-300">
          Step 2 · Choose your Chosen Champion: a {tag} champion unit. Use <b>★ Champion</b> on a card below.
          <button type="button" className="ml-2 underline" onClick={() => setFilters({ ...EMPTY_FILTERS, query: tag ?? '', types: ['unit'] })}>
            Show {tag} units
          </button>
        </div>
      )}
      <FilterBar filters={filters} onChange={setFilters} sort={sort} onSort={setSort} showOwned resultCount={pool.length} pricesAvailable={prices.available} domainOptions={domainOptions} />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="h-4 w-4 accent-gold-400" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} />
        Only show cards legal for {legendChampion(legend)} ({legend.domains.map(cap).join(' / ')})
      </label>
      <PriceBar show={showPrices} onChange={setShowPrices} />
      <CardGrid
        cards={pool}
        dense
        renderCard={(c) => {
          const zone = defaultZone(c);
          const n = inDeck(c.id, zone);
          const side = zone === 'main' ? inDeck(c.id, 'sideboard') : 0;
          const isChamp = draft.championId === c.id;
          return (
            <CardTile
              card={c}
              onOpen={setOpen}
              owned={col.qty(c.id) || undefined}
              price={showPrices && prices.available ? prices.priceOf(c.id) : undefined}
              footer={
                <div className="mt-1 space-y-1">
                  <div className="flex gap-1">
                    <button type="button" className="btn-ghost flex-1 px-1 py-1 text-xs" onClick={() => ed.add(c.id, zone)}>
                      + {zone === 'main' ? 'Main' : zone === 'rune' ? 'Rune' : 'Field'}{n ? ` (${n})` : ''}
                    </button>
                    {zone === 'main' && (
                      <button type="button" className="btn-ghost px-1.5 py-1 text-xs" title="Add to sideboard" onClick={() => ed.add(c.id, 'sideboard')}>
                        SB{side ? ` ${side}` : ''}
                      </button>
                    )}
                  </div>
                  {isChampionOption(c) && (
                    <button
                      type="button"
                      className={`btn w-full px-1 py-1 text-xs ${isChamp ? 'bg-gold-400 text-ink-950' : 'border border-gold-400/50 text-gold-300 hover:bg-gold-400/10'}`}
                      onClick={() => ed.update((d) => ({ ...d, championId: isChamp ? null : c.id }))}
                    >
                      {isChamp ? '★ Chosen Champion' : '★ Champion'}
                    </button>
                  )}
                </div>
              }
            />
          );
        }}
      />
    </div>
  );

  // ---------------- deck panel
  const deckPanel = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {([['Legend', legend, () => setPickingLegend(true)], ['Chosen Champion', champion, () => champion && setOpen(champion)]] as const).map(
          ([label, c, onClick]) => (
            <button key={label} type="button" onClick={onClick} className={`panel flex items-center gap-2 p-2 text-left hover:border-gold-400/50 ${c && flagged.has(c.id) ? 'border-red-700' : ''}`}>
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-ink-700">{c && <img src={cardImage(c)} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
                <div className="truncate text-sm font-medium">{c ? displayName(c) : <span className="text-slate-500">Not chosen</span>}</div>
                {c && label === 'Legend' && <DomainDots domains={c.domains} size={8} />}
              </div>
            </button>
          ),
        )}
      </div>

      {(['main', 'rune', 'battlefield', 'sideboard'] as Zone[]).map((zone) => {
        const rows = zoneEntries(zone);
        if (zone === 'sideboard' && !rows.length) return null;
        return (
          <section key={zone} className="panel overflow-hidden">
            <header className="flex items-center justify-between border-b border-ink-700 px-3 py-2">
              <h3 className="text-sm font-semibold">{ZONE_LABEL[zone]}</h3>
              <span className="text-xs tabular-nums text-slate-400">
                {zoneCount[zone]} / {zoneTarget[zone]}
              </span>
            </header>
            {rows.length || (zone === 'main' && champion) ? (
              <ul className="divide-y divide-ink-700/60">
                {zone === 'main' && champion && (
                  <li className="flex items-center gap-2 py-1 pl-2 pr-3 text-sm">
                    <span className="w-5 text-center text-xs font-bold text-slate-400">{champion.energy}</span>
                    <DomainDots domains={champion.domains} size={8} />
                    <span className="flex-1 truncate">{displayName(champion)}</span>
                    <span className="text-xs text-gold-300">★ Champion · 1</span>
                  </li>
                )}
                {rows.map(({ e, c }: { e: DeckEntry; c: Card }) => (
                  <DeckRow
                    key={`${e.cardId}|${zone}`}
                    card={c}
                    quantity={e.quantity}
                    owned={ownedFor(c)}
                    needed={neededFor(c)}
                    flagged={flagged.has(c.id)}
                    onChange={(n) => ed.setQuantity(c.id, zone, n)}
                    onOpen={() => setOpen(c)}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-xs text-slate-500">Empty</p>
            )}
          </section>
        );
      })}

      <section className="panel p-3">
        <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>{summary.isLegal ? '✓ Deck is legal' : 'Deck checks'}</span>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-normal text-slate-400">
            <input type="checkbox" className="accent-gold-400" checked={tournament} onChange={(e) => setTournament(e.target.checked)} />
            Tournament (exactly 40)
          </label>
        </h3>
        {summary.issues.length ? (
          <ul className="space-y-1 text-sm">
            {summary.issues.map((i, n) => (
              <li key={n} className={i.level === 'error' ? 'text-amber-200' : 'text-slate-400'}>
                {i.level === 'error' ? '⚠ ' : 'ℹ '}
                {i.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-300">All construction rules pass.</p>
        )}
      </section>

      <section className="panel p-3">
        <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>{totalMissing ? `Missing ${totalMissing} card${totalMissing === 1 ? '' : 's'}` : '✓ You own every card'}</span>
          {totalMissing > 0 && (
            <button
              type="button"
              className="text-xs font-normal text-gold-300 underline"
              onClick={() =>
                copyText(
                  missingCost
                    .filter((l) => l.missing)
                    .map((l) => `${l.missing} ${displayName(l.card)} (${l.card.publicCode})${l.unit != null ? ` ~${formatPrice(l.unit)} each` : ''}`)
                    .join('\n'),
                  'Missing list copied',
                )
              }
            >
              Copy list
            </button>
          )}
        </h3>
        {totalMissing > 0 && prices.available && (
          <p className="mb-2 text-sm text-slate-300" title="Cheapest current TCGplayer market price for each missing card, any printing or finish">
            About <b className="text-emerald-300">{formatPrice(costToComplete)}</b> to complete
            {unpricedMissing > 0 && <span className="text-slate-500"> ({unpricedMissing} card{unpricedMissing === 1 ? '' : 's'} unpriced)</span>}
          </p>
        )}
        {totalMissing > 0 && (
          <ul className="space-y-0.5 text-sm">
            {missingCost
              .filter((l) => l.missing)
              .map((l) => (
                <li key={l.baseKey} className="flex justify-between gap-2">
                  <button type="button" className="truncate text-left hover:text-gold-300" onClick={() => setOpen(l.card)}>
                    {displayName(l.card)}
                  </button>
                  <span className="shrink-0 tabular-nums text-red-200">
                    need {l.missing} <span className="text-slate-500">(own {l.owned})</span>
                    {prices.available && l.unit != null && <span className="ml-1.5 text-emerald-300/90">{formatPrice(l.unit * l.missing)}</span>}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Notes</span>
        <textarea rows={3} className="w-full" value={draft.notes} onChange={(e) => ed.update((d) => ({ ...d, notes: e.target.value }))} placeholder="Mulligan plan, matchups…" />
      </label>
    </div>
  );

  const detailActions = open && (
    <div className="flex flex-wrap gap-2">
      {open.type !== 'legend' && !isToken(open) && (
        <>
          <button type="button" className="btn-primary" onClick={() => ed.add(open.id, defaultZone(open))}>
            + {ZONE_LABEL[defaultZone(open)]} ({inDeck(open.id, defaultZone(open))})
          </button>
          {defaultZone(open) === 'main' && (
            <button type="button" className="btn-ghost" onClick={() => ed.add(open.id, 'sideboard')}>
              + Sideboard ({inDeck(open.id, 'sideboard')})
            </button>
          )}
        </>
      )}
      {open.type === 'legend' && (
        <button type="button" className="btn-primary" onClick={() => { setLegend(open); setOpen(null); }}>
          Use as Legend
        </button>
      )}
      {isChampionOption(open) && (
        <button type="button" className="btn-ghost" onClick={() => ed.update((d) => ({ ...d, championId: d.championId === open.id ? null : open.id }))}>
          {draft.championId === open.id ? 'Unset Chosen Champion' : '★ Set as Chosen Champion'}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/decks" className="btn-ghost px-2" aria-label="Back to decks">←</Link>
        <input
          value={draft.name}
          onChange={(e) => ed.update((d) => ({ ...d, name: e.target.value }))}
          className="min-w-0 flex-1 basis-48 border-transparent bg-transparent font-display text-xl text-gold-300 focus:border-ink-600 focus:bg-ink-800"
          aria-label="Deck name"
        />
        <span className={`text-xs ${ed.saveState === 'error' ? 'text-red-300' : 'text-slate-500'}`}>
          {ed.saveState === 'saved' ? 'Saved' : ed.saveState === 'error' ? 'Save failed' : 'Saving…'}
        </span>
        {ed.saveState === 'error' && <button type="button" className="btn-ghost text-xs" onClick={ed.retrySave}>Retry</button>}
        <button type="button" className="btn-ghost" onClick={() => copyText(deckText(draft), 'Decklist copied')}>Copy decklist</button>
      </div>
      {ed.saveError && <ErrorNote error={ed.saveError} />}
      {copied && <p className="text-sm text-emerald-300">{copied}</p>}

      {/* Mobile tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-800 p-1 text-sm lg:hidden">
        <button type="button" onClick={() => setTab('add')} className={`rounded-md py-1.5 ${tab === 'add' ? 'bg-ink-600 text-white' : 'text-slate-400'}`}>Add cards</button>
        <button type="button" onClick={() => setTab('deck')} className={`rounded-md py-1.5 ${tab === 'deck' ? 'bg-ink-600 text-white' : 'text-slate-400'}`}>
          Deck ({summary.mainCount}) {summary.isLegal ? '✓' : '⚠'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className={tab === 'add' ? '' : 'hidden lg:block'}>{addPanel}</div>
        <aside className={`${tab === 'deck' ? '' : 'hidden lg:block'} lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1`}>{deckPanel}</aside>
      </div>

      {open && (
        <CardDetailModal card={open} onClose={close} onSelect={setOpen} qty={col.qty} setQty={col.setQty} actions={detailActions} />
      )}
    </div>
  );
}
