import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey && !url.includes('your-project-ref'));

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
