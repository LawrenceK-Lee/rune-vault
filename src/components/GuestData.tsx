import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabaseConfigured } from '../lib/supabase';
import { clearGuestData, guestDataSummary, moveGuestDataToAccount } from '../lib/store';

/** One-line reminder for signed-out visitors that their data lives in this browser. */
export function GuestNotice({ className = '' }: { className?: string }) {
  const { session, loading } = useAuth();
  if (session || loading) return null;
  return (
    <p className={`shrink-0 flex-wrap items-center gap-x-2 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs text-slate-400 ${className || 'flex'}`}>
      <span>
        <b className="font-medium text-slate-300">Saved in this browser only.</b>{' '}
        {supabaseConfigured ? 'Sign in to keep it safe and use it on other devices.' : 'Use Import / Export on the Collection page to back it up.'}
      </span>
      {supabaseConfigured && (
        <Link to="/login" className="font-medium text-gold-300 underline hover:text-gold-200">
          Sign in or create an account
        </Link>
      )}
    </p>
  );
}

const DISMISS_KEY = 'rv.guestPromptDismissed';

/** After signing in, offer to move anything saved in this browser into the account. */
export function GuestDataPrompt() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const userId = session?.user.id ?? null;
  const [summary, setSummary] = useState(guestDataSummary);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => setSummary(guestDataSummary()), [userId]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 6000);
    return () => clearTimeout(t);
  }, [done]);

  const box = 'fixed inset-x-4 z-50 rounded-xl border border-gold-400/50 bg-ink-800 p-4 shadow-2xl shadow-black/60 sm:left-auto sm:right-6 sm:w-[26rem]';
  const style = { bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' };

  if (done)
    return (
      <div className={box} style={style} role="status">
        <p className="text-sm text-emerald-200">{done}</p>
      </div>
    );
  if (!userId || dismissed || (!summary.cards && !summary.decks)) return null;

  const what = [summary.cards && `${summary.cards.toLocaleString()} card${summary.cards === 1 ? '' : 's'}`, summary.decks && `${summary.decks} deck${summary.decks === 1 ? '' : 's'}`]
    .filter(Boolean)
    .join(' and ');

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await moveGuestDataToAccount(userId);
      await qc.invalidateQueries({ predicate: (q) => q.queryKey.includes(userId) });
      setSummary({ cards: 0, decks: 0 });
      setDone(`Moved ${r.cards.toLocaleString()} cards and ${r.decks} deck${r.decks === 1 ? '' : 's'} into your account.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className={box} style={style} role="dialog" aria-label="Move browser data to your account">
      <h2 className="text-sm font-semibold text-slate-100">Move what you saved before signing in?</h2>
      <p className="mt-1 text-sm text-slate-400">
        This browser has {what} from before you signed in. Moving them adds the card counts to your account's collection and adds the decks to your deck list.
      </p>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {confirmDelete ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-300">Delete them from this browser?</span>
          <button type="button" className="btn-danger" onClick={() => { clearGuestData(); setSummary({ cards: 0, decks: 0 }); }}>Delete</button>
          <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={move}>{busy ? 'Moving…' : 'Move to my account'}</button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={later}>Not now</button>
          <button type="button" className="ml-auto text-xs text-slate-500 underline hover:text-red-300" disabled={busy} onClick={() => setConfirmDelete(true)}>
            Delete instead
          </button>
        </div>
      )}
    </div>
  );
}
