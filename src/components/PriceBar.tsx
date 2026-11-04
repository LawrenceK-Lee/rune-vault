import { useEffect, useState } from 'react';
import { setCurrencySettings, useMoney } from '../hooks/useMoney';
import { usePrices } from '../hooks/usePrices';
import { PRICE_SOURCE_REFRESH_UTC, PRICE_SYNC_UTC, localTimeOfUtc } from '../lib/prices';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Explains where prices come from and when they update. */
export function PriceDisclaimer({ className = '' }: { className?: string }) {
  const { updatedAt } = usePrices();
  const money = useMoney();
  return (
    <p className={`text-xs leading-relaxed text-slate-400 ${className}`}>
      Prices are TCGplayer market prices in US dollars
      {money.code !== 'USD' && (
        <>
          , converted to {money.code} at 1 USD = {money.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {money.code}
          {money.isCustomRate ? ' (your rate)' : money.ratesDate ? ` (European Central Bank rate, ${new Date(money.ratesDate).toLocaleDateString()})` : ''}
        </>
      )}
      . TCGplayer prices change once a day, at about {localTimeOfUtc(PRICE_SOURCE_REFRESH_UTC)}, and this app picks them up at about{' '}
      {localTimeOfUtc(PRICE_SYNC_UTC)} (your time).
      {updatedAt && <> Last updated {fmtDate(updatedAt)}.</>} Prices are estimates; what sellers actually charge can be higher or lower.
    </p>
  );
}

function RateInput() {
  const money = useMoney();
  const shown = money.isCustomRate ? money.settings.customRate : money.dailyRate;
  const [text, setText] = useState(shown != null ? String(shown) : '');
  useEffect(() => setText(shown != null ? String(shown) : ''), [shown, money.code]);

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>1 USD =</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        aria-label={`Exchange rate, ${money.code} per US dollar`}
        className="w-24 px-2 py-1"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value !== '' && v > 0) setCurrencySettings({ code: money.settings.code, customRate: v });
        }}
      />
      <span>{money.code}</span>
      {money.isCustomRate ? (
        <button
          type="button"
          className="text-xs text-gold-300 underline"
          onClick={() => setCurrencySettings({ code: money.settings.code, customRate: null })}
          disabled={money.dailyRate == null}
        >
          Use daily rate{money.dailyRate != null ? ` (${money.dailyRate})` : ''}
        </button>
      ) : (
        <span className="text-xs text-slate-500">daily rate · type to set your own</span>
      )}
    </span>
  );
}

/** Show-prices switch, currency picker and a collapsible price notice, shown above card grids. */
export function PriceBar({ show, onChange }: { show: boolean; onChange: (v: boolean) => void }) {
  const { available, updatedAt } = usePrices();
  const money = useMoney();
  const [about, setAbout] = useState(false);
  if (!available) return null;

  return (
    <div className="panel shrink-0 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-300 sm:gap-x-5">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-gold-400" checked={show} onChange={(e) => onChange(e.target.checked)} />
          <span className="sm:hidden">Prices</span>
          <span className="hidden sm:inline">Show prices</span>
        </label>
        {show && (
          <>
            <label className="flex items-center gap-2">
              Currency
              <select
                value={money.settings.code}
                onChange={(e) => setCurrencySettings({ code: e.target.value, customRate: null })}
                className="py-1"
              >
                {money.currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {/* Rate + update summary: always shown on larger screens, behind "Details" on phones. */}
            {money.settings.code !== 'USD' && (
              <span className={`${about ? 'flex' : 'hidden'} sm:flex`}>
                <RateInput />
              </span>
            )}
            <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <span className={`${about ? 'inline' : 'hidden'} sm:inline`}>
                TCGplayer prices, updated daily ~{localTimeOfUtc(PRICE_SYNC_UTC)}
                {updatedAt && <> · last {new Date(updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</>}
              </span>
              <button type="button" className="text-gold-300 underline" onClick={() => setAbout((a) => !a)} aria-expanded={about}>
                {about ? 'Hide' : <><span className="sm:hidden">Details</span><span className="hidden sm:inline">About prices</span></>}
              </button>
            </span>
          </>
        )}
      </div>
      {show && about && <PriceDisclaimer className="mt-2 border-t border-ink-700 pt-2" />}
    </div>
  );
}
