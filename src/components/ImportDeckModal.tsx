import { useEffect, useMemo, useState } from 'react';
import { parseDecklist } from '../lib/decklist';
import { CARDS_BY_ID, displayName } from '../lib/cards';
import { ErrorNote } from './bits';

const EXAMPLE = `Legend: Jinx, Loose Cannon
Champion: Jinx, Demolitionist

Main deck:
3 Blazing Scorcher
3x Get Excited!
...

Runes:
6 Fury Rune
6 Chaos Rune

Battlefields:
1 Altar to Unity
...`;

export function ImportDeckModal({
  onClose,
  onImport,
  busy,
  error,
}: {
  onClose: () => void;
  onImport: (deck: { name: string } & ReturnType<typeof parseDecklist>) => void;
  busy: boolean;
  error: unknown;
}) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const parsed = useMemo(() => parseDecklist(text), [text]);
  const total = (zone: string) => parsed.entries.filter((e) => e.zone === zone).reduce((n, e) => n + e.quantity, 0);
  const recognised = parsed.entries.length + (parsed.legendId ? 1 : 0) + (parsed.championId ? 1 : 0);
  const legend = parsed.legendId ? CARDS_BY_ID.get(parsed.legendId) : undefined;
  const champion = parsed.championId ? CARDS_BY_ID.get(parsed.championId) : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const deckName = name.trim() || parsed.name || (legend ? `${displayName(legend)} deck` : 'Imported deck');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Import decklist">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-900 p-4 sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="heading text-xl">Import decklist</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-ink-800 hover:text-white" aria-label="Close">✕</button>
        </div>
        <p className="mb-3 text-sm text-slate-400">
          Paste a decklist as text, one card per line, like <code className="text-slate-300">3 Blazing Scorcher</code> or <code className="text-slate-300">3x Jinx - Rebel</code>. Section headings
          (Legend, Champion, Main deck, Runes, Battlefields, Sideboard) are optional. Collector codes such as <code className="text-slate-300">OGN-001</code> work too, and
          lists copied from this app's <b>Copy decklist</b> button import exactly.
        </p>
        <div className="grid gap-4 md:grid-cols-[1fr_15rem]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            rows={14}
            className="w-full font-mono text-sm"
            autoFocus
            spellCheck={false}
          />
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Deck name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={deckName} className="w-full" />
            </label>
            <dl className="panel grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 p-3">
              <dt className="text-slate-400">Legend</dt>
              <dd className={legend ? '' : 'text-amber-300'}>{legend ? displayName(legend) : 'not found'}</dd>
              <dt className="text-slate-400">Champion</dt>
              <dd className={champion ? '' : 'text-amber-300'}>{champion ? displayName(champion) : 'not found'}</dd>
              <dt className="text-slate-400">Main</dt>
              <dd className="tabular-nums">{total('main') + (champion ? 1 : 0)}</dd>
              <dt className="text-slate-400">Runes</dt>
              <dd className="tabular-nums">{total('rune')}</dd>
              <dt className="text-slate-400">Battlefields</dt>
              <dd className="tabular-nums">{total('battlefield')}</dd>
              {total('sideboard') > 0 && (
                <>
                  <dt className="text-slate-400">Sideboard</dt>
                  <dd className="tabular-nums">{total('sideboard')}</dd>
                </>
              )}
            </dl>
            {(!legend || !champion) && recognised > 0 && (
              <p className="text-xs text-slate-400">You can pick a missing Legend or Champion in the deck editor.</p>
            )}
          </div>
        </div>

        {parsed.unknown.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-800/70 bg-amber-950/30 p-3 text-sm">
            <p className="mb-1 font-medium text-amber-200">Not recognised ({parsed.unknown.length}), will be skipped:</p>
            <ul className="max-h-28 overflow-y-auto font-mono text-xs text-amber-100/80">
              {parsed.unknown.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        )}
        {parsed.notes.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-xs text-slate-400">
            {parsed.notes.map((n, i) => <li key={i}>ℹ {n}</li>)}
          </ul>
        )}

        <div className="mt-4"><ErrorNote error={error} /></div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy || recognised === 0} onClick={() => onImport({ ...parsed, name: deckName })}>
            {busy ? 'Creating…' : 'Create deck'}
          </button>
        </div>
      </div>
    </div>
  );
}
