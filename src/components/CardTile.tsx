import { memo, useState } from 'react';
import type { Card } from '../types/card';
import { cardImage } from '../lib/ui';
import { displayName } from '../lib/cards';
import { QuantityStepper } from './bits';

interface Props {
  card: Card;
  owned?: number; // undefined = not signed in, hide collection controls
  onOwnedChange?: (n: number) => void;
  onOpen?: (card: Card) => void;
  /** Extra content under the image (e.g. deck add buttons). */
  footer?: React.ReactNode;
  dimmed?: boolean;
}

function CardTileImpl({ card, owned, onOwnedChange, onOpen, footer, dimmed }: Props) {
  const [loaded, setLoaded] = useState(false);
  const landscape = card.orientation === 'landscape';
  return (
    <div className={`group relative flex flex-col ${dimmed ? 'opacity-40' : ''}`}>
      <button
        type="button"
        onClick={() => onOpen?.(card)}
        className="relative block overflow-hidden rounded-[4.5%/3.3%] bg-ink-800 shadow-lg shadow-black/40 ring-1 ring-ink-700 transition-transform hover:-translate-y-0.5 hover:ring-gold-400/60 focus-visible:ring-2 focus-visible:ring-gold-400"
        style={{ aspectRatio: '744 / 1039' }}
        title={displayName(card)}
      >
        {!loaded && (
          <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-slate-500">
            {displayName(card)}
          </span>
        )}
        {card.imageUrl && (
          <img
            src={cardImage(card)}
            alt={displayName(card)}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${landscape ? 'object-contain' : ''}`}
          />
        )}
        {owned != null && owned > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-ink-950/85 px-1.5 py-0.5 text-xs font-bold text-gold-300 ring-1 ring-gold-400/50">
            ×{owned}
          </span>
        )}
      </button>
      {owned != null && onOwnedChange && (
        <div className="mt-1.5 flex justify-center">
          <QuantityStepper size="sm" value={owned} onChange={onOwnedChange} label={`Owned copies of ${displayName(card)}`} />
        </div>
      )}
      {footer}
    </div>
  );
}

export const CardTile = memo(CardTileImpl);
