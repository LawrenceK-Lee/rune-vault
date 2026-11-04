import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GUEST_STORAGE_KEY, cloudStore, localStore } from '../lib/store';
import { useAuth } from './useAuth';

/**
 * The store for the current visitor: their account when signed in, otherwise this browser.
 * `scope` goes into query keys so account and guest data never mix in the cache.
 */
export function useDataStore() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const store = useMemo(() => (userId ? cloudStore(userId) : localStore), [userId]);
  return { store, scope: userId ?? 'guest', ready: !loading, isGuest: !userId };
}

/** Keep guest data in step when it changes in another tab. Mount once. */
export function useGuestStorageSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== GUEST_STORAGE_KEY && e.key !== null) return;
      qc.invalidateQueries({ predicate: (q) => q.queryKey.includes('guest') });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [qc]);
}
