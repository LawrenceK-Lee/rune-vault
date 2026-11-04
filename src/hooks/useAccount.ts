import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { OAUTH_PROVIDERS } from '../lib/auth';
import { useUserId } from './useAuth';

/** Which OAuth providers are switched on in the Supabase project (public auth settings). */
export function useEnabledProviders() {
  return useQuery({
    queryKey: ['auth-settings'],
    enabled: supabaseConfigured,
    staleTime: Infinity,
    queryFn: async () => {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      if (!res.ok) return [];
      const settings = (await res.json()) as { external?: Record<string, boolean> };
      return OAUTH_PROVIDERS.filter((p) => settings.external?.[p.id]);
    },
  });
}

export interface Profile {
  id: string;
  username: string | null;
}

export function useProfile() {
  const userId = useUserId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, username').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? { id: userId!, username: null };
    },
  });

  const setUsername = useMutation({
    mutationFn: async (username: string) => {
      const { error } = await supabase.from('profiles').update({ username: username.toLowerCase() }).eq('id', userId!);
      if (error) throw new Error(error.code === '23505' ? 'That username is taken.' : error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });

  return { profile: query.data ?? null, isLoading: query.isLoading, error: query.error, setUsername };
}
