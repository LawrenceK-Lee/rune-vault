import { useEffect, useRef, useState } from 'react';
import type { Card } from '../types/card';

const PAGE = 60;

/**
 * Responsive card grid with its own scroll area, so search, filters and the price
 * bar above it stay in view. Place it in a flex column with a bounded height
 * (see ScrollPage); it fills the remaining space.
 *
 * Cards render in pages as you scroll, so a 1,400-card list doesn't mount
 * 1,400 images at once.
 */
export function CardGrid({
  cards,
  renderCard,
  dense = false,
  empty = 'No cards match these filters.',
  header,
}: {
  cards: Card[];
  renderCard: (c: Card) => React.ReactNode;
  dense?: boolean;
  empty?: React.ReactNode;
  /** Content that scrolls with the grid, above the cards (e.g. collection stats). */
  header?: React.ReactNode;
}) {
  const [shown, setShown] = useState(PAGE);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // New results (search/filter/sort change): start from the top again.
  useEffect(() => {
    setShown(PAGE);
    scroller.current?.scrollTo({ top: 0 });
  }, [cards]);

  // Load the next page when the sentinel nears the bottom of the scroll area.
  // Re-observing after each page means a short page that still shows the
  // sentinel keeps loading until the area is filled.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setShown((n) => Math.min(n + PAGE, cards.length)),
      { root: scroller.current, rootMargin: '800px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cards.length, shown]);

  return (
    <div ref={scroller} className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-6 pt-1">
      {header}
      {cards.length ? (
        <div
          className={`grid gap-4 ${
            dense
              ? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))]'
              : 'grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(215px,1fr))]'
          }`}
        >
          {cards.slice(0, shown).map((c) => (
            <div key={c.id}>{renderCard(c)}</div>
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-slate-400">{empty}</p>
      )}
      {shown < cards.length && <div ref={sentinel} className="h-10" />}
    </div>
  );
}
