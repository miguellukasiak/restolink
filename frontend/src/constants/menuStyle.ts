/*
 * How a public menu can look: typefaces, background patterns and the ready
 * themes built from them.
 *
 * A theme is only a starting point — four stored values (primary colour,
 * background colour, `font_family`, `menu_pattern`) that the owner can go on
 * to change one by one. Nothing here is stored except those values, so a
 * theme can be renamed or retuned without touching saved menus.
 */

/** One face of a pairing: a CSS family and the weight to set it in. */
export interface FontFace {
  family: string;
  weight: number;
}

/**
 * A typeface choice, stored in `restaurant.font_family` by `value`.
 *
 * Headings (category names, the dish title) can carry character; dish names
 * and descriptions must stay readable at 12–14px on a phone, so a display or
 * script face is always paired with a plain one for the body.
 */
export interface FontPairing {
  value: string;
  label: string;
  heading: FontFace;
  body: FontFace;
  /** Some faces set small for their size (handwriting); headings scale up. */
  headingScale?: number;
}

const FALLBACKS: Record<string, string> = {
  Roboto: '"Segoe UI", Arial, sans-serif',
  Montserrat: '"Segoe UI", Arial, sans-serif',
  Nunito: '"Segoe UI", Arial, sans-serif',
  'Josefin Sans': '"Segoe UI", Arial, sans-serif',
  Oswald: '"Arial Narrow", Arial, sans-serif',
  'DM Sans': '"Segoe UI", Arial, sans-serif',
  'Playfair Display': 'Georgia, serif',
  Lora: 'Georgia, serif',
  'DM Serif Display': 'Georgia, serif',
  Georgia: '"Times New Roman", serif',
  Pacifico: '"Brush Script MT", cursive',
  Caveat: '"Segoe Print", cursive',
};

/** A CSS font stack for a family name. */
export function fontStack(family: string): string {
  const fallback = FALLBACKS[family] ?? 'sans-serif';
  return family === 'Georgia' ? `Georgia, ${fallback}` : `"${family}", ${fallback}`;
}

export const FONT_PAIRINGS: readonly FontPairing[] = [
  {
    // The original default: Roboto text under classic serif headings.
    value: 'Roboto',
    label: 'Klasyczna',
    heading: { family: 'Georgia', weight: 700 },
    body: { family: 'Roboto', weight: 400 },
  },
  {
    value: 'Montserrat',
    label: 'Nowoczesna',
    heading: { family: 'Montserrat', weight: 700 },
    body: { family: 'Montserrat', weight: 400 },
  },
  {
    value: 'Playfair Display',
    label: 'Elegancka',
    heading: { family: 'Playfair Display', weight: 700 },
    body: { family: 'Playfair Display', weight: 400 },
  },
  {
    value: 'Lora',
    label: 'Domowa',
    heading: { family: 'Lora', weight: 700 },
    body: { family: 'Lora', weight: 400 },
  },
  {
    value: 'Nunito',
    label: 'Przyjazna',
    heading: { family: 'Nunito', weight: 800 },
    body: { family: 'Nunito', weight: 400 },
  },
  {
    value: 'Josefin Sans',
    label: 'Skandynawska',
    heading: { family: 'Josefin Sans', weight: 700 },
    body: { family: 'Nunito', weight: 400 },
  },
  {
    value: 'Oswald',
    label: 'Mocna',
    heading: { family: 'Oswald', weight: 600 },
    body: { family: 'Roboto', weight: 400 },
  },
  {
    value: 'DM Serif Display',
    label: 'Szlachetna',
    heading: { family: 'DM Serif Display', weight: 400 },
    body: { family: 'DM Sans', weight: 400 },
  },
  {
    value: 'Pacifico',
    label: 'Wakacyjna',
    heading: { family: 'Pacifico', weight: 400 },
    body: { family: 'Nunito', weight: 400 },
  },
  {
    value: 'Caveat',
    label: 'Odręczna',
    heading: { family: 'Caveat', weight: 700 },
    body: { family: 'Nunito', weight: 400 },
    headingScale: 1.3,
  },
];

/** The pairing for a stored `font_family`; unknown values fall back to the default. */
export function getFontPairing(value?: string | null): FontPairing {
  return FONT_PAIRINGS.find((pairing) => pairing.value === value) ?? FONT_PAIRINGS[0];
}

/** The body text stack for a stored `font_family`. */
export function getFontStack(value?: string | null): string {
  return fontStack(getFontPairing(value).body.family);
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export type VenueKind = 'restaurant' | 'cafe' | 'bar' | 'street' | 'world' | 'fine';

export const VENUES: { id: VenueKind; label: string }[] = [
  { id: 'restaurant', label: 'Restauracja' },
  { id: 'cafe', label: 'Kawiarnia i cukiernia' },
  { id: 'bar', label: 'Bar i pub' },
  { id: 'street', label: 'Street food' },
  { id: 'world', label: 'Kuchnie świata' },
  { id: 'fine', label: 'Fine dining' },
];

export interface MenuTheme {
  id: string;
  name: string;
  vibe: string;
  venues: VenueKind[];
  primary_color: string;
  background_color: string;
  font_family: string;
  menu_pattern: string | null;
}

/**
 * The gallery. Every pairing of colours here has been chosen so the
 * readability guard (utils/colors.ts) lands on clear text; the pattern
 * artwork lives in components/public/menuPatterns.ts.
 */
export const MENU_THEMES: readonly MenuTheme[] = [
  {
    id: 'classic',
    name: 'Czysta klasyka',
    vibe: 'Biel i grafit — pasuje wszędzie',
    venues: ['restaurant', 'cafe', 'fine'],
    primary_color: '#1C1B1F',
    background_color: '#FFFFFF',
    font_family: 'Montserrat',
    menu_pattern: null,
  },
  {
    id: 'trattoria',
    name: 'Włoska trattoria',
    vibe: 'Pomidorowa czerwień i obrus w kratkę',
    venues: ['restaurant', 'world'],
    primary_color: '#B8322A',
    background_color: '#FBF3E4',
    font_family: 'Lora',
    menu_pattern: 'gingham',
  },
  {
    id: 'hawaii',
    name: 'Hawajska plaża',
    vibe: 'Koral, piasek i liście palm',
    venues: ['world', 'bar', 'street'],
    primary_color: '#E4572E',
    background_color: '#FFF4E0',
    font_family: 'Pacifico',
    menu_pattern: 'palms',
  },
  {
    id: 'nordic',
    name: 'Nordycki spokój',
    vibe: 'Chłodny błękit, len i dużo oddechu',
    venues: ['cafe', 'restaurant'],
    primary_color: '#3D5A6C',
    background_color: '#F4F1EC',
    font_family: 'Josefin Sans',
    menu_pattern: 'grid',
  },
  {
    id: 'pub',
    name: 'Pub i piwiarnia',
    vibe: 'Ciemne drewno i bursztynowe piwo',
    venues: ['bar'],
    primary_color: '#E3A42B',
    background_color: '#2A1E17',
    font_family: 'Oswald',
    menu_pattern: 'wood',
  },
  {
    id: 'japan',
    name: 'Japoński minimalizm',
    vibe: 'Papier ryżowy, cynober i fale',
    venues: ['world', 'fine'],
    primary_color: '#B7282E',
    background_color: '#F7F3EA',
    font_family: 'DM Serif Display',
    menu_pattern: 'seigaiha',
  },
  {
    id: 'cafe',
    name: 'Kawiarnia',
    vibe: 'Kawa z mlekiem i odręczne napisy',
    venues: ['cafe'],
    primary_color: '#6F4E37',
    background_color: '#F6EFE7',
    font_family: 'Caveat',
    menu_pattern: 'dots',
  },
  {
    id: 'street',
    name: 'Street food',
    vibe: 'Musztardowa żółć, czerń i energia',
    venues: ['street', 'bar'],
    primary_color: '#111111',
    background_color: '#FFD23F',
    font_family: 'Oswald',
    menu_pattern: 'dots',
  },
  {
    id: 'bistro',
    name: 'Paryskie bistro',
    vibe: 'Butelkowa zieleń i markiza w paski',
    venues: ['restaurant', 'cafe'],
    primary_color: '#1E4D2B',
    background_color: '#FAF6EC',
    font_family: 'Playfair Display',
    menu_pattern: 'stripes',
  },
  {
    id: 'greek',
    name: 'Grecka tawerna',
    vibe: 'Biel Santorini i błękit morza',
    venues: ['world', 'restaurant'],
    primary_color: '#1F5FAD',
    background_color: '#F6F9FC',
    font_family: 'Lora',
    menu_pattern: 'waves',
  },
  {
    id: 'cocktail',
    name: 'Bar koktajlowy',
    vibe: 'Granatowa noc i neonowy róż',
    venues: ['bar', 'fine'],
    primary_color: '#FF5C8A',
    background_color: '#141A33',
    font_family: 'Josefin Sans',
    menu_pattern: 'terrazzo',
  },
  {
    id: 'vegan',
    name: 'Zielona kuchnia',
    vibe: 'Świeże liście i len',
    venues: ['restaurant', 'cafe', 'street'],
    primary_color: '#2E7D32',
    background_color: '#F2F7EE',
    font_family: 'Nunito',
    menu_pattern: 'leaves',
  },
  {
    id: 'mexican',
    name: 'Meksykańska fiesta',
    vibe: 'Papryka, limonka i pasiasty koc',
    venues: ['world', 'street'],
    primary_color: '#C2185B',
    background_color: '#FFF3D6',
    font_family: 'Nunito',
    menu_pattern: 'stripes',
  },
  {
    id: 'karczma',
    name: 'Polska karczma',
    vibe: 'Ciepłe drewno, len i czerwień',
    venues: ['restaurant'],
    primary_color: '#9E2A2B',
    background_color: '#F3E9DC',
    font_family: 'Lora',
    menu_pattern: 'wood',
  },
  {
    id: 'patisserie',
    name: 'Cukiernia',
    vibe: 'Pastelowy róż i kolorowa posypka',
    venues: ['cafe'],
    primary_color: '#D6336C',
    background_color: '#FFF0F5',
    font_family: 'Nunito',
    menu_pattern: 'terrazzo',
  },
  {
    id: 'seafood',
    name: 'Owoce morza',
    vibe: 'Morska zieleń i piasek',
    venues: ['restaurant', 'world'],
    primary_color: '#0E7C86',
    background_color: '#F3F8F7',
    font_family: 'Montserrat',
    menu_pattern: 'waves',
  },
  {
    id: 'steakhouse',
    name: 'Steakhouse',
    vibe: 'Grafit, miedź i ogień z grilla',
    venues: ['fine', 'restaurant'],
    primary_color: '#C8743A',
    background_color: '#1C1C1E',
    font_family: 'DM Serif Display',
    menu_pattern: null,
  },
  {
    id: 'dark-elegance',
    name: 'Ciemna elegancja',
    vibe: 'Głęboka czerń ze złotem',
    venues: ['fine', 'bar'],
    primary_color: '#D4AF37',
    background_color: '#1A1A1A',
    font_family: 'Playfair Display',
    menu_pattern: null,
  },
  {
    id: 'vivid',
    name: 'Wyrazisty fiolet',
    vibe: 'Energetyczny fiolet na jasnym tle',
    venues: ['street', 'cafe'],
    primary_color: '#5B4CDB',
    background_color: '#F5F3FF',
    font_family: 'Montserrat',
    menu_pattern: null,
  },
];
