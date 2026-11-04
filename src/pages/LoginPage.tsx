import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useEnabledProviders } from '../hooks/useAccount';
import {
  MIN_PASSWORD,
  USERNAME_HINT,
  USERNAME_RE,
  signInWithIdentifier,
  signInWithProvider,
  signUpWithEmail,
  signUpWithUsername,
  usernameAvailable,
} from '../lib/auth';
import { ErrorNote } from '../components/bits';

const PROVIDER_STYLE: Record<string, string> = {
  google: 'bg-white text-slate-900 hover:bg-slate-100',
  discord: 'bg-[#5865F2] text-white hover:bg-[#4752c4]',
};

function ProviderIcon({ id }: { id: string }) {
  if (id === 'google')
    return (
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    );
  if (id === 'discord')
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
      </svg>
    );
  return null;
}

export function LoginPage() {
  const { session } = useAuth();
  const location = useLocation();
  const providers = useEnabledProviders();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [identifier, setIdentifier] = useState(''); // email or username
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/collection';
  if (session) return <Navigate to={from} replace />;
  const redirect = window.location.origin + from;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') return run(() => signInWithIdentifier(identifier, password));
    if (mode === 'forgot')
      return run(async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/account?reset=1` });
        if (error) throw new Error(error.message);
        setInfo('If that email has an account, a link to set a new password is on its way.');
      });
    return run(async () => {
      const name = username.trim().toLowerCase();
      if (!USERNAME_RE.test(name)) throw new Error(`Username: ${USERNAME_HINT}`);
      if (password.length < MIN_PASSWORD) throw new Error(`Passwords need at least ${MIN_PASSWORD} characters.`);
      if (!(await usernameAvailable(name))) throw new Error('That username is taken.');
      if (email.trim()) {
        const mustConfirm = await signUpWithEmail(email, password, name, redirect);
        if (mustConfirm) setInfo(`Check ${email.trim()} to confirm your account, then sign in.`);
      } else {
        await signUpWithUsername(name, password);
      }
    });
  };

  const tabs = [
    ['signin', 'Sign in'],
    ['signup', 'Create account'],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <h1 className="heading mb-1 text-2xl">{mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in'}</h1>
      <p className="mb-5 text-sm text-slate-400">Your collection and decks are saved to your account and sync across devices.</p>

      {mode !== 'forgot' && (providers.data?.length ?? 0) > 0 && (
        <>
          <div className="space-y-2">
            {providers.data!.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => run(() => signInWithProvider(p.id, redirect))}
                className={`btn w-full py-2.5 ${PROVIDER_STYLE[p.id] ?? 'btn-ghost'}`}
              >
                <ProviderIcon id={p.id} /> Continue with {p.label}
              </button>
            ))}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500">
            <span className="h-px flex-1 bg-ink-700" /> or <span className="h-px flex-1 bg-ink-700" />
          </div>
        </>
      )}

      {mode !== 'forgot' && (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-ink-800 p-1 text-sm">
          {tabs.map(([m, label]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(null); setInfo(null); }} className={`rounded-md py-1.5 ${mode === m ? 'bg-ink-600 text-white' : 'text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signin' && (
          <input required autoComplete="username" placeholder="Email or username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full" />
        )}
        {mode === 'signup' && (
          <>
            <label className="block">
              <input required autoComplete="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full" />
              <span className="mt-1 block text-xs text-slate-500">{USERNAME_HINT}</span>
            </label>
            <label className="block">
              <input type="email" autoComplete="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
              <span className="mt-1 block text-xs text-slate-500">Without an email you can't reset a forgotten password. You can add one later in Account settings.</span>
            </label>
          </>
        )}
        {mode === 'forgot' && (
          <input type="email" required autoComplete="email" placeholder="Your account's email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        )}
        {mode !== 'forgot' && (
          <input
            type="password"
            required
            minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
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
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        {mode === 'forgot' ? (
          <button type="button" className="text-gold-300 underline" onClick={() => setMode('signin')}>Back to sign in</button>
        ) : (
          mode === 'signin' && (
            <button type="button" className="text-slate-400 underline hover:text-slate-200" onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          )
        )}
      </div>
    </div>
  );
}
