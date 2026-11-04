import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ErrorNote } from '../components/bits';

export function LoginPage() {
  const { session } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/collection';
  if (session) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const redirect = window.location.origin + from;
    const res =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'signup'
          ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
          : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (res.error) return setError(res.error.message);
    if (mode === 'magic') setInfo('Check your email for a sign-in link.');
    else if (mode === 'signup' && !res.data.session) setInfo('Check your email to confirm your account, then sign in.');
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="heading mb-1 text-2xl">{mode === 'signup' ? 'Create account' : 'Sign in'}</h1>
      <p className="mb-6 text-sm text-slate-400">Your collection and decks are saved to your account and sync across devices.</p>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-ink-800 p-1 text-sm">
        {(['signin', 'signup', 'magic'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md py-1.5 ${mode === m ? 'bg-ink-600 text-white' : 'text-slate-400'}`}>
            {m === 'signin' ? 'Sign in' : m === 'signup' ? 'Sign up' : 'Email link'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        {mode !== 'magic' && (
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
          />
        )}
        <ErrorNote error={error} />
        {info && <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">{info}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send sign-in link'}
        </button>
      </form>
    </div>
  );
}
