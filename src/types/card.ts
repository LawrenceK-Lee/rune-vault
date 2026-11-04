export type CardType = 'legend' | 'unit' | 'spell' | 'gear' | 'rune' | 'battlefield';
export type Domain = 'fury' | 'calm' | 'mind' | 'body' | 'chaos' | 'order' | 'colorless';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'showcase';
export type Supertype = 'champion' | 'signature' | 'basic' | 'token';

/** One printing of a card, as written by scripts/sync-cards.mjs. */
export interface Card {
  id: string; // e.g. "ogn-066-298", stable per printing
  code: string; // e.g. "OGN-066", "SFD-227*", "RAD-SP1"
  publicCode: string; // e.g. "OGN-066/298"
  name: string;
  subtitle: string | null; // champions: "Alluring", "Inquisitive" …
  /** Shared by every printing of the same card (alt art, signed, reprint). */
  baseKey: string;
  set: string | null;
  setName: string | null;
  collectorNumber: number | null;
  type: CardType | null;
  supertypes: Supertype[];
  tags: string[];
  rarity: Rarity | null;
  domains: Domain[];
  energy: number | null;
  power: number | null;
  might: number | null;
  mightBonus: number | null;
  text: string;
  effect: string | null;
  imageUrl: string | null;
  illustrator: string | null;
  orientation: 'portrait' | 'landscape';
  isAltArt: boolean;
  isSigned: boolean;
}

export interface CardSet {
  id: string;
  name: string;
  cardCount: number;
  baseCount: number;
}

export const DOMAINS: Domain[] = ['fury', 'calm', 'mind', 'body', 'chaos', 'order', 'colorless'];
export const CARD_TYPES: CardType[] = ['legend', 'unit', 'spell', 'gear', 'rune', 'battlefield'];
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'showcase'];
