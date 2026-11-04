import { useEffect, useState } from 'react';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** useState that remembers its value in localStorage (per-device UI preferences only). */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`rbc.${key}`);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      // Merge objects so fields added in later versions get their defaults.
      return isPlainObject(initial) && isPlainObject(parsed) ? ({ ...initial, ...parsed } as T) : (parsed as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`rbc.${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
