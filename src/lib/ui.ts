import type { Card, Domain } from '../types/card';

/** Riot's image CDN (Sanity) can resize and convert on the fly. */
export function cardImage(card: Pick<Card, 'imageUrl'>, width: 360 | 744 = 360) {
  if (!card.imageUrl) return undefined;
  const sep = card.imageUrl.includes('?') ? '&' : '?';
  return `${card.imageUrl}${sep}w=${width}&fm=webp`;
}

export const DOMAIN_COLORS: Record<Domain, string> = {
  fury: '#d9483b',
  calm: '#3fae7a',
  mind: '#3f7fd9',
  body: '#e38b2c',
  chaos: '#9b5bd6',
  order: '#e6c76b',
  colorless: '#8a93a6',
};

export const RARITY_COLORS: Record<string, string> = {
  common: '#9aa3b5',
  uncommon: '#41b4b8',
  rare: '#4f8be0',
  epic: '#b05be0',
  showcase: '#e6c76b',
};

export const cap = (s: string | null | undefined) => (s ? s[0].toUpperCase() + s.slice(1) : '');

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
