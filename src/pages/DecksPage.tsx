import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CARDS_BY_ID, displayName } from '../lib/cards';
import { missingCards, validateDeck } from '../lib/deckRules';
import { cardImage } from '../lib/ui';
import { toDeckInput, useDeckList, useDeckMutations, type DeckWithCards } from '../hooks/useDecks';
import { useCollection } from '../hooks/useCollection';
import { DomainDots, ErrorNote, Spinner } from '../components/bits';

function DeckCard({ deck, qtyBase, onDelete }: { deck: DeckWithCards; qtyBase: (k: string) => number; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const input = toDeckInput(deck);
  const summary = validateDeck(input, CARDS_BY_ID);
  const missing = missingCards(input, CARDS_BY_ID, qtyBase).reduce((n, l) => n + l.missing, 0);
  const legend = deck.legend_id ? CARDS_BY_ID.get(deck.legend_id) : undefined;
  const champion = deck.champion_id ? CARDS_BY_ID.get(deck.champion_id) : undefined;
  const art = champion ?? legend;

  return (
    <div className="panel group relative overflow-hidden">
      <Link to={`/decks/${deck.id}`} className="flex gap-3 p-3">
        <div className="h-24 w-[4.3rem] shrink-0 overflow-hidden rounded-md bg-ink-700">
          {art && <img src={cardImage(art)} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-100 group-hover:text-gold-300">{deck.name}</h2>
          <p className="truncate text-sm text-slate-400">
            {legend ? displayName(legend) : 'No legend yet'}
          </p>
          {legend && <DomainDots domains={legend.domains} />}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className={`rounded-full px-2 py-0.5 ${summary.isLegal ? 'bg-emerald-900/60 text-emerald-200' : 'bg-amber-900/50 text-amber-200'}`}>
              {summary.isLegal ? 'Legal' : `${summary.issues.filter((i) => i.level === 'error').length} issue(s)`}
            </span>
            <span className="rounded-full bg-ink-700 px-2 py-0.5 text-slate-300">{summary.mainCount} main</span>
            <span className={`rounded-full px-2 py-0.5 ${missing ? 'bg-red-900/50 text-red-200' : 'bg-ink-700 text-slate-300'}`}>
              {missing ? `Missing ${missing}` : 'All owned'}
            </span>
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        {confirming ? (
          <span className="flex gap-1">
            <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={onDelete}>Delete</button>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirming(false)}>Keep</button>
          </span>
        ) : (
          <button type="button" className="rounded p-1 text-slate-500 opacity-0 hover:text-red-300 group-hover:opacity-100 focus:opacity-100" onClick={() => setConfirming(true)} aria-label={`Delete ${deck.name}`}>
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export function DecksPage() {
  const decks = useDeckList();
  const { create, remove } = useDeckMutations();
  const col = useCollection();
  const navigate = useNavigate();

  async function newDeck() {
    const d = await create.mutateAsync({ name: 'New deck' });
    navigate(`/decks/${d.id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="heading text-2xl">My Decks</h1>
        <button type="button" className="btn-primary" onClick={newDeck} disabled={create.isPending}>
          + New deck
        </button>
      </div>
      <ErrorNote error={decks.error ?? create.error ?? remove.error} />
      {decks.isLoading ? (
        <Spinner />
      ) : decks.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.data.map((d) => (
            <DeckCard key={d.id} deck={d} qtyBase={col.qtyBase} onDelete={() => remove.mutate(d.id)} />
          ))}
        </div>
      ) : (
        <div className="panel px-6 py-12 text-center text-slate-400">
          <p className="mb-4">No decks yet. Start one by picking a Legend.</p>
          <button type="button" className="btn-primary" onClick={newDeck} disabled={create.isPending}>
            + New deck
          </button>
        </div>
      )}
    </div>
  );
}
