import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { usePrices } from './usePrices';

/** Per-device currency preference. `customRate` = units of `code` per 1 USD, or null to use the daily rate. */
export interface CurrencySettings {
  code: string;
  customRate: number | null;
}

const KEY = 'rbc.currency';
const DEFAULT: CurrencySettings = { code: 'USD', customRate: null };
const listeners = new Set<() => void>();

let cache: CurrencySettings = read();

function read(): CurrencySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw);
    return {
      code: typeof v.code === 'string' && /^[A-Z]{3}$/.test(v.code) ? v.code : 'USD',
      customRate: typeof v.customRate === 'number' && v.customRate > 0 ? v.customRate : null,
    };
  } catch {
    return DEFAULT;
  }
}

export function setCurrencySettings(next: CurrencySettings) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: setting lasts for this session */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Converts and formats USD prices in the user's chosen currency. */
export function useMoney() {
  const settings = useSyncExternalStore(subscribe, () => cache);
  const { rates, ratesDate } = usePrices();

  const dailyRate = settings.code === 'USD' ? 1 : rates[settings.code] ?? null;
  const rate = settings.code === 'USD' ? 1 : settings.customRate ?? dailyRate;
  // If we have no rate at all for the chosen currency, fall back to showing USD.
  const code = rate == null ? 'USD' : settings.code;
  const factor = rate ?? 1;

  const fmt = useMemo(() => {
    const make = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat(undefined, { style: 'currency', currency: code, ...o });
    return { full: make({}), whole: make({ maximumFractionDigits: 0 }), compact: make({ notation: 'compact', maximumFractionDigits: 1 }) };
  }, [code]);

  const convert = useCallback((usd: number) => usd * factor, [factor]);

  /** Full precision, e.g. "$12.34". */
  const format = useCallback((usd: number | null | undefined) => (usd == null ? '—' : fmt.full.format(usd * factor)), [fmt, factor]);

  /** Short form for tiles: "$0.25", "$120", "$1.2K". */
  const formatShort = useCallback(
    (usd: number) => {
      const v = usd * factor;
      return v >= 1000 ? fmt.compact.format(v) : v >= 100 ? fmt.whole.format(v) : fmt.full.format(v);
    },
    [fmt, factor],
  );

  return {
    settings,
    code,
    rate: factor,
    dailyRate,
    ratesDate,
    isCustomRate: settings.code !== 'USD' && settings.customRate != null,
    currencies: ['USD', ...Object.keys(rates).sort()],
    convert,
    format,
    formatShort,
  };
}
