import { FunctionsHttpError, type Provider } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Username-only accounts get a placeholder email at this domain (see the create-username-account function). */
export const PLACEHOLDER_EMAIL_DOMAIN = 'example.com';
export const isPlaceholderEmail = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const USERNAME_HINT = '3–20 characters: letters, numbers and underscores.';
export const MIN_PASSWORD = 8;

/** OAuth providers the app knows how to show. Only the ones enabled in Supabase appear. */
export const OAUTH_PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'discord', label: 'Discord' },
];

export async function signInWithUsername(username: string, password: string) {
  const { data: email, error } = await supabase.rpc('email_for_username_login', {
    p_username: username.trim().toLowerCase(),
    p_password: password,
  });
  if (error) throw new Error(error.message);
  if (!email) throw new Error('Wrong username or password.');
  const res = await supabase.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(res.error.message);
}

export async function signInWithEmail(email: string, password: string) {
  const res = await supabase.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(res.error.message === 'Invalid login credentials' ? 'Wrong email or password.' : res.error.message);
}

/** Sign in with whichever the person typed: an email (contains "@") or a username. */
export const signInWithIdentifier = (identifier: string, password: string) =>
  identifier.includes('@') ? signInWithEmail(identifier.trim(), password) : signInWithUsername(identifier, password);

export async function usernameAvailable(username: string) {
  const { data, error } = await supabase.rpc('username_available', { p_username: username });
  if (error) throw new Error(error.message);
  return !!data;
}

/** Username + password only. Creates the account via the Edge Function, then signs in. */
export async function signUpWithUsername(username: string, password: string) {
  const { error } = await supabase.functions.invoke('create-username-account', { body: { username, password } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? 'Could not create the account.');
    }
    throw new Error(
      "Couldn't reach the account service. If you run this app, check that the create-username-account Edge Function is deployed (see README).",
    );
  }
  await signInWithUsername(username, password);
}

/** Email + password (+ optional username). Returns true if the person must confirm their email first. */
export async function signUpWithEmail(email: string, password: string, username: string | null, redirectTo: string) {
  const res = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: redirectTo, data: username ? { username } : undefined },
  });
  if (res.error) throw new Error(res.error.message);
  return !res.data.session;
}

export async function signInWithProvider(provider: Provider, redirectTo: string) {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw new Error(error.message);
}
