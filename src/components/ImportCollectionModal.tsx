import { useEffect, useRef, useState } from 'react';
import { displayName } from '../lib/cards';
import { parseCollectionRows, readCollectionFile, type ParsedCollection } from '../lib/collectionImport';
import { ErrorNote } from './bits';

export type ImportMode = 'add' | 'replace';

export function ImportCollectionModal({
  onClose,
  onImport,
  busy,
  owned,
}: {
  onClose: () => void;
  onImport: (parsed: ParsedCollection, mode: ImportMode) => Promise<void>;
  busy: boolean;
  owned: (cardId: string) => number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCollection | null>(null);
  const [mode, setMode] = useState<ImportMode>('add');
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function load(file: File) {
    setError(null);
    setParsed(null);
    setFileName(file.name);
    setReading(true);
    try {
      const result = parseCollectionRows(await readCollectionFile(file));
      if (!result.items.length && !result.unknown.length) throw new Error('That file looks empty.');
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  }

  async function submit() {
    if (!parsed) return;
    setError(null);
    try {
      await onImport(parsed, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Import collection">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-ink-700 bg-ink-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
          <h2 className="heading text-xl">Import collection</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-ink-800 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
            className={`block w-full rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? 'border-gold-400 bg-gold-400/10' : 'border-ink-600 hover:border-gold-400/60'}`}
          >
            <span className="block font-medium text-slate-100">{reading ? 'Reading…' : fileName ? `${fileName} · choose another file` : 'Choose a file or drop it here'}</span>
            <span className="mt-1 block text-sm text-slate-400">Excel (.xlsx), CSV, or a JSON export from this app</span>
          </button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt,.json,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />

          {!parsed && (
            <div className="text-sm text-slate-400">
              <p className="mb-1">The first sheet is read. Rows can identify cards by any of:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>a collector code, like <code className="text-slate-300">OGN-066</code></li>
                <li><b className="text-slate-300">Set</b> and <b className="text-slate-300">Card Number</b> columns (TCGplayer exports work)</li>
                <li>a card <b className="text-slate-300">Name</b> column</li>
              </ul>
              <p className="mt-2">Add a <b className="text-slate-300">Quantity</b> column for how many you own; without one each row counts as one copy. Lists like <code className="text-slate-300">3x Jinx</code> in a single column work too.</p>
            </div>
          )}

          {parsed && (
            <>
              <p className="text-sm">
                Found <b className="text-emerald-300">{parsed.items.length.toLocaleString()}</b> different cards, <b className="text-emerald-300">{parsed.copies.toLocaleString()}</b> copies in total.
              </p>
              {parsed.items.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-ink-700">
                  <table className="w-full table-fixed text-sm">
                    <thead className="sticky top-0 bg-ink-800 text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">Card</th>
                        <th className="w-20 px-3 py-1.5 text-right font-semibold">In file</th>
                        <th className="w-24 px-3 py-1.5 text-right font-semibold">You own</th>
                        <th className="w-20 px-3 py-1.5 text-right font-semibold">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700/60">
                      {parsed.items.map(({ card, quantity }) => {
                        const now = owned(card.id);
                        const after = mode === 'add' ? now + quantity : quantity;
                        return (
                          <tr key={card.id}>
                            <td className="truncate px-3 py-1">
                              {displayName(card)} <span className="text-xs text-slate-500">{card.publicCode}</span>
                            </td>
                            <td className="px-3 py-1 text-right tabular-nums">{quantity}</td>
                            <td className="px-3 py-1 text-right tabular-nums text-slate-400">{now}</td>
                            <td className={`px-3 py-1 text-right tabular-nums ${after !== now ? 'text-gold-300' : 'text-slate-400'}`}>{after}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {parsed.unknown.length > 0 && (
                <div className="rounded-lg border border-amber-800/70 bg-amber-950/30 p-3 text-sm">
                  <p className="mb-1 font-medium text-amber-200">Not recognised ({parsed.unknown.length}), will be skipped:</p>
                  <ul className="max-h-28 overflow-y-auto font-mono text-xs text-amber-100/80">
                    {parsed.unknown.map((l, i) => <li key={i} className="truncate">{l}</li>)}
                  </ul>
                </div>
              )}
              {parsed.notes.length > 0 && (
                <ul className="space-y-0.5 text-xs text-slate-400">
                  {parsed.notes.map((n, i) => <li key={i}>ℹ {n}</li>)}
                </ul>
              )}
              {parsed.items.length > 0 && (
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">How to apply it</legend>
                  {([
                    ['add', 'Add to what I own', 'For new pulls or a purchase: the file\'s counts are added on top.'],
                    ['replace', 'Replace counts for these cards', 'For a full inventory: these cards get exactly the file\'s counts. Cards not in the file are left alone.'],
                  ] as const).map(([value, title, hint]) => (
                    <label key={value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === value ? 'border-gold-400/70 bg-gold-400/5' : 'border-ink-700 hover:border-ink-600'}`}>
                      <input type="radio" name="import-mode" checked={mode === value} onChange={() => setMode(value)} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium text-slate-100">{title}</span>
                        <span className="block text-xs text-slate-400">{hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
          <ErrorNote error={error} />
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-ink-700 px-4 py-3 sm:px-6">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy || !parsed?.items.length} onClick={submit}>
            {busy ? 'Importing…' : parsed?.items.length ? `Import ${parsed.items.length.toLocaleString()} cards` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
