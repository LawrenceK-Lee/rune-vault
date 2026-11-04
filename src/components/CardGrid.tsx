import { useEffect, useRef, useState } from 'react';
import type { Card } from '../types/card';

const PAGE = 60;

/**
 * Responsive grid that renders cards in pages as you scroll, so a 1,400-card
 * list doesn't mount 1,400 images at once.
 */
export function CardGrid({
  cards,
  renderCard,
  dense = false,
  empty = 'No cards match these filters.',
}: {
  cards: Card[];
  renderCard: (c: Card) => React.ReactNode;
  dense?: boolean;
  empty?: React.ReactNode;
}) {
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  // Reset paging when the list changes.
  useEffect(() => setShown(PAGE), [cards]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setShown((n) => Math.min(n + PAGE, cards.length)),
      { rootMargin: '800px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cards.length]);

  if (!cards.length) return <p className="py-16 text-center text-slate-400">{empty}</p>;

  return (
    <>
      <div
        className={`grid gap-3 ${
          dense
            ? 'grid-cols-[repeat(auto-fill,minmax(110px,1fr))]'
            : 'grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]'
        }`}
      >
        {cards.slice(0, shown).map((c) => (
          <div key={c.id}>{renderCard(c)}</div>
        ))}
      </div>
      {shown < cards.length && <div ref={sentinel} className="h-10" />}
    </>
  );
}
