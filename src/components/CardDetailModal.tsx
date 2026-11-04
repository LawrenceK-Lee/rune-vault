import { useEffect } from 'react';
import type { Card } from '../types/card';
import { PRINTINGS, displayName, legendChampion } from '../lib/cards';
import { cap, cardImage } from '../lib/ui';
import { DomainDots, QuantityStepper, RarityGem } from './bits';
import { CardText } from './CardText';
import { usePrices } from '../hooks/usePrices';
import { cheapestCopy, headlinePrice, tcgplayerUrl, type FinishPrice } from '../lib/prices';
import { useMoney } from '../hooks/useMoney';
import { PriceDisclaimer } from './PriceBar';

function PriceSection({ card }: { card: Card }) {
  const { available, prices, updatedAt } = usePrices();
  const { format: formatPrice } = useMoney();
  if (!available) return null;
  const entry = prices[card.id];
  const cheapest = cheapestCopy(card, prices);
  const finishes = ([['Normal', entry?.n], ['Foil', entry?.f]] as [string, FinishPrice | undefined][]).filter(([, f]) => f);

  return (
    <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">Price · {card.publicCode}</h3>
        {updatedAt && <span className="text-[11px] text-slate-500">TCGplayer, {new Date(updatedAt).toLocaleDateString()}</span>}
      </div>
      {finishes.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="font-normal">Finish</th>
              <th className="font-normal">Market</th>
              <th className="font-normal">Lowest listing</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {finishes.map(([label, f]) => (
              <tr key={label}>
                <td className="text-slate-300">{label}</td>
                <td className="font-semibold text-emerald-300">{formatPrice(f!.m)}</td>
                <td className="text-slate-300">{formatPrice(f!.l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-400">No current TCGplayer price for this printing.</p>
      )}
      {cheapest && cheapest.cardId !== card.id && (
        <p className="mt-2 text-xs text-slate-400">
          Cheapest printing of this card: {formatPrice(cheapest.price)} ({PRINTINGS.get(card.baseKey)?.find((c) => c.id === cheapest.cardId)?.publicCode})
        </p>
      )}
      {entry && (
        <a href={tcgplayerUrl(entry.p)} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3 w-full">
          Buy on TCGplayer ↗
        </a>
      )}
      <PriceDisclaimer className="mt-3" />
    </div>
  );
}

function PrintingPrice({ id }: { id: string }) {
  const { prices } = usePrices();
  const { format: formatPrice } = useMoney();
  const p = headlinePrice(prices[id]);
  return p == null ? null : <span className="ml-1 text-emerald-300/90">· {formatPrice(p)}</span>;
}

export function CardDetailModal({
  card,
  onClose,
  onSelect,
  qty,
  setQty,
  actions,
}: {
  card: Card;
  onClose: () => void;
  onSelect: (c: Card) => void;
  qty?: (id: string) => number;
  setQty?: (id: string, n: number) => void;
  actions?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const printings = PRINTINGS.get(card.baseKey) ?? [card];
  const stats: [string, string | number | null][] = [
    ['Type', [...card.supertypes.filter((s) => s !== 'basic'), card.type].filter(Boolean).map(cap).join(' ')],
    ['Energy', card.energy],
    ['Power', card.power],
    ['Might', card.might],
    ['Might bonus', card.mightBonus != null ? `+${card.mightBonus}` : null],
    ['Tags', card.tags.join(', ') || null],
    ['Champion', card.type === 'legend' ? legendChampion(card) : null],
    ['Set', `${card.setName} · ${card.publicCode}`],
    ['Artist', card.illustrator],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={displayName(card)}>
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-900 p-4 sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full p-2 text-slate-400 hover:bg-ink-800 hover:text-white" aria-label="Close">
          ✕
        </button>
        <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
          <img src={cardImage(card, 744)} alt={displayName(card)} className="mx-auto w-full max-w-[320px] rounded-[4.5%/3.3%] shadow-2xl shadow-black/60" />
          <div className="min-w-0 space-y-4">
            <div>
              <h2 className="heading pr-8 text-2xl">{card.name}</h2>
              {card.subtitle && <p className="text-lg text-slate-300">{card.subtitle}</p>}
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
                <DomainDots domains={card.domains} size={12} />
                <span className="capitalize">{card.domains.join(' / ')}</span>
                <RarityGem rarity={card.rarity} />
                <span className="capitalize">{card.rarity}</span>
              </div>
            </div>

            {(card.text || card.effect) && (
              <div className="space-y-2 whitespace-pre-line rounded-lg bg-ink-800 p-3 text-sm leading-relaxed text-slate-200">
                {card.text && <p><CardText text={card.text} /></p>}
                {card.effect && <p className="border-t border-ink-600 pt-2"><CardText text={card.effect} /></p>}
              </div>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {stats
                .filter(([, v]) => v != null && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className="text-slate-100">{v}</dd>
                  </div>
                ))}
            </dl>

            {actions}

            <PriceSection card={card} />

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Printings {qty ? '· copies you own' : ''}
              </h3>
              <ul className="divide-y divide-ink-700 rounded-lg border border-ink-700">
                {printings.map((p) => (
                  <li key={p.id} className={`flex items-center gap-3 px-3 py-2 ${p.id === card.id ? 'bg-ink-800' : ''}`}>
                    <button type="button" onClick={() => onSelect(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <img src={cardImage(p)} alt="" className="h-12 w-auto rounded" loading="lazy" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.publicCode}</span>
                        <span className="block text-xs text-slate-400">
                          {p.setName} · {cap(p.rarity)}
                          {p.isSigned ? ' · Signed' : p.isAltArt ? ' · Alt art' : ''}
                          <PrintingPrice id={p.id} />
                        </span>
                      </span>
                    </button>
                    {qty && setQty && <QuantityStepper size="sm" value={qty(p.id)} onChange={(n) => setQty(p.id, n)} />}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
