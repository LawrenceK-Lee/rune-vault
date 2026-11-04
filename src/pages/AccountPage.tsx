import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserIdentity } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useEnabledProviders, useProfile } from '../hooks/useAccount';
import { MIN_PASSWORD, OAUTH_PROVIDERS, USERNAME_HINT, USERNAME_RE, isPlaceholderEmail } from '../lib/auth';
import { ErrorNote, Spinner } from '../components/bits';

type Status = { kind: 'ok' | 'error'; text: string } | null;

function Section({ title, description, children, highlight }: { title: string; description?: React.ReactNode; children: React.ReactNode; highlight?: boolean }) {
  return (
    <section className={`panel p-4 sm:p-5 ${highlight ? 'border-gold-400/70' : ''}`}>
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return status.kind === 'error' ? (
    <div className="mt-3"><ErrorNote error={status.text} /></div>
  ) : (
    <p className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">{status.text}</p>
  );
}

function UsernameSection() {
  const { profile, setUsername } = useProfile();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>(null);
  useEffect(() => setValue(profile?.username ?? ''), [profile?.username]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const name = value.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) return setStatus({ kind: 'error', text: USERNAME_HINT });
    try {
      await setUsername.mutateAsync(name);
      setStatus({ kind: 'ok', text: `Username set to ${name}. You can sign in with it and your password.` });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <Section title="Username" description="Sign in with your username and password, as an alternative to email or Google/Discord.">
      <form onSubmit={save} className="flex flex-wrap gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Choose a username" autoComplete="username" className="min-w-0 flex-1 basis-56" />
        <button type="submit" className="btn-primary" disabled={setUsername.isPending || value.trim().toLowerCase() === (profile?.username ?? '')}>
          {profile?.username ? 'Change username' : 'Set username'}
        </button>
      </form>
      <p className="mt-1 text-xs text-slate-500">{USERNAME_HINT}</p>
      <StatusLine status={status} />
    </Section>
  );
}

function EmailSection() {
  const { session } = useAuth();
  const current = session?.user.email ?? null;
  const pending = session?.user.new_email ?? null;
  const placeholder = isPlaceholderEmail(current);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.updateUser({ email: value.trim() }, { emailRedirectTo: `${window.location.origin}/account` });
    setBusy(false);
    if (error) setStatus({ kind: 'error', text: error.message });
    else {
      setStatus({ kind: 'ok', text: `We sent a confirmation link to ${value.trim()}. The change takes effect once you open it.` });
      setValue('');
    }
  };

  return (
    <Section
      title={placeholder ? 'Connect an email' : 'Email'}
      description={
        placeholder
          ? 'Your account has no email yet. Connect one so you can reset your password if you forget it, and sign in with email.'
          : <>Signed in as <b className="text-slate-200">{current}</b>. Changing it sends a confirmation link to the new address.</>
      }
    >
      {pending && <p className="mb-3 text-sm text-gold-300">Waiting for you to confirm {pending}.</p>}
      <form onSubmit={save} className="flex flex-wrap gap-2">
        <input type="email" required value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder ? 'you@example.org' : 'New email address'} autoComplete="email" className="min-w-0 flex-1 basis-56" />
        <button type="submit" className="btn-primary" disabled={busy}>{placeholder ? 'Connect email' : 'Change email'}</button>
      </form>
      <StatusLine status={status} />
    </Section>
  );
}

function PasswordSection({ highlight }: { highlight: boolean }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (pw.length < MIN_PASSWORD) return setStatus({ kind: 'error', text: `Passwords need at least ${MIN_PASSWORD} characters.` });
    if (pw !== pw2) return setStatus({ kind: 'error', text: "The two passwords don't match." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setStatus({ kind: 'error', text: error.message });
    else {
      setStatus({ kind: 'ok', text: 'Password updated.' });
      setPw('');
      setPw2('');
    }
  };

  return (
    <Section
      title={highlight ? 'Set a new password' : 'Password'}
      description={highlight ? 'You opened a password reset link. Choose your new password.' : 'Change your password, or set one if you signed up with Google or Discord.'}
      highlight={highlight}
    >
      <form onSubmit={save} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus={highlight} />
        <input type="password" autoComplete="new-password" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={busy || !pw}>Save password</button>
      </form>
      <StatusLine status={status} />
    </Section>
  );
}

function MethodsSection() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const providers = useEnabledProviders();
  const [status, setStatus] = useState<Status>(null);
  const identities = useQuery({
    queryKey: ['identities', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data.identities;
    },
  });

  const label = (i: UserIdentity) =>
    i.provider === 'email'
      ? isPlaceholderEmail(session?.user.email) ? 'Username & password' : `Email & password (${session?.user.email})`
      : `${OAUTH_PROVIDERS.find((p) => p.id === i.provider)?.label ?? i.provider}${i.identity_data?.email ? ` (${i.identity_data.email})` : ''}`;

  const link = async (provider: (typeof OAUTH_PROVIDERS)[number]['id']) => {
    setStatus(null);
    const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: `${window.location.origin}/account` } });
    if (error)
      setStatus({
        kind: 'error',
        text: error.message.toLowerCase().includes('manual linking')
          ? 'Connecting accounts is turned off for this app (Supabase: Authentication → Sign In / Providers → "Allow manual linking").'
          : error.message,
      });
  };

  const unlink = async (identity: UserIdentity) => {
    setStatus(null);
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) setStatus({ kind: 'error', text: error.message });
    else qc.invalidateQueries({ queryKey: ['identities'] });
  };

  const linked = new Set(identities.data?.map((i) => i.provider));
  const linkable = (providers.data ?? []).filter((p) => !linked.has(p.id));

  return (
    <Section title="Sign-in methods" description="Ways you can sign in to this account.">
      {identities.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-ink-700 rounded-lg border border-ink-700">
          {identities.data?.map((i) => (
            <li key={i.identity_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{label(i)}</span>
              {(identities.data?.length ?? 0) > 1 && i.provider !== 'email' && (
                <button type="button" className="text-xs text-slate-400 underline hover:text-red-300" onClick={() => unlink(i)}>
                  Disconnect
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {linkable.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkable.map((p) => (
            <button key={p.id} type="button" className="btn-ghost" onClick={() => link(p.id)}>
              Connect {p.label}
            </button>
          ))}
        </div>
      )}
      <StatusLine status={status} />
    </Section>
  );
}

export function AccountPage() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const resetting = params.get('reset') === '1';
  if (!session) return <Spinner />;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-8">
      <h1 className="heading text-2xl">Account settings</h1>
      {resetting && <PasswordSection highlight />}
      <UsernameSection />
      <EmailSection />
      {!resetting && <PasswordSection highlight={false} />}
      <MethodsSection />
    </div>
  );
}
