import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Publishable key (sb_publishable_…); the legacy "anon" key name is still accepted.
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

if (anonKey?.startsWith('sb_secret_')) {
  throw new Error('A Supabase SECRET key is configured in the browser app. Use the publishable key (sb_publishable_…) instead, and rotate the secret key in Supabase.');
}

export const supabaseConfigured = Boolean(url && anonKey && !url.includes('your-project-ref') && !anonKey.includes('your-key'));

// When not configured we still create a client against a dummy URL so imports work;
// the UI shows setup instructions instead of making requests.
export const supabase = createClient(
  supabaseConfigured ? url! : 'http://localhost.invalid',
  supabaseConfigured ? anonKey! : 'not-configured',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export interface CollectionRow {
  card_id: string;
  quantity: number;
}

export interface DeckRow {
  id: string;
  name: string;
  legend_id: string | null;
  champion_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeckCardRow {
  deck_id: string;
  card_id: string;
  zone: 'main' | 'rune' | 'battlefield' | 'sideboard';
  quantity: number;
}
