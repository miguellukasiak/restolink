/*
 * How a public menu can look: typefaces, background patterns and the ready
 * themes built from them.
 *
 * A theme is only a starting point — four stored values (primary colour,
 * background colour, `font_family`, `menu_pattern`) that the owner can go on
 * to change one by one. Nothing here is stored except those values, so a
 * theme can be renamed or retuned without touching saved menus. Names and
 * descriptions are panel strings (src/i18n/panel), keyed by id.
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
  /** Names it in the panel: `appearance.font.<id>`. */
  id: string;
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
    id: 'classic',
    heading: { family: 'Georgia', weight: 700 },
    body: { family: 'Roboto', weight: 400 },
  },
  {
    value: 'Montserrat',
    id: 'modern',
    heading: { family: 'Montserrat', weight: 700 },
    body: { family: 'Montserrat', weight: 400 },
  },
  {
    value: 'Playfair Display',
    id: 'elegant',
    heading: { family: 'Playfair Display', weight: 700 },
    body: { family: 'Playfair Display', weight: 400 },
  },
  {
    value: 'Lora',
    id: 'homely',
    heading: { family: 'Lora', weight: 700 },
    body: { family: 'Lora', weight: 400 },
  },
  {
    value: 'Nunito',
    id: 'friendly',
    heading: { family: 'Nunito', weight: 800 },
    body: { family: 'Nunito', weight: 400 },
  },
  {
    value: 'Josefin Sans',
    id: 'scandi',
    heading: { family: 'Josefin Sans', weight: 700 },
    body: { family: 'Nunito', weight: 400 },
  },
  {
    value: 'Oswald',
    id: 'bold',
    heading: { family: 'Oswald', weight: 600 },
    body: { family: 'Roboto', weight: 400 },
  },
  {
    value: 'DM Serif Display',
    id: 'refined',
    heading: { family: 'DM Serif Display', weight: 400 },
    body: { family: 'DM Sans', weight: 400 },
  },
  {
    value: 'Pacifico',
    id: 'holiday',
    heading: { family: 'Pacifico', weight: 400 },
    body: { family: 'Nunito', weight: 400 },
  },
  {
    value: 'Caveat',
    id: 'handwritten',
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

/** Named in the panel by `appearance.venue.<kind>`. */
export const VENUES: readonly VenueKind[] = [
  'restaurant',
  'cafe',
  'bar',
  'street',
  'world',
  'fine',
];

/** Named and described in the panel by `appearance.theme.<id>.{name,vibe}`. */
export interface MenuTheme {
  id: string;
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
    venues: ['restaurant', 'cafe', 'fine'],
    primary_color: '#1C1B1F',
    background_color: '#FFFFFF',
    font_family: 'Montserrat',
    menu_pattern: null,
  },
  {
    id: 'trattoria',
    venues: ['restaurant', 'world'],
    primary_color: '#B8322A',
    background_color: '#FBF3E4',
    font_family: 'Lora',
    menu_pattern: 'gingham',
  },
  {
    id: 'hawaii',
    venues: ['world', 'bar', 'street'],
    primary_color: '#E4572E',
    background_color: '#FFF4E0',
    font_family: 'Pacifico',
    menu_pattern: 'palms',
  },
  {
    id: 'nordic',
    venues: ['cafe', 'restaurant'],
    primary_color: '#3D5A6C',
    background_color: '#F4F1EC',
    font_family: 'Josefin Sans',
    menu_pattern: 'grid',
  },
  {
    id: 'pub',
    venues: ['bar'],
    primary_color: '#E3A42B',
    background_color: '#2A1E17',
    font_family: 'Oswald',
    menu_pattern: 'wood',
  },
  {
    id: 'japan',
    venues: ['world', 'fine'],
    primary_color: '#B7282E',
    background_color: '#F7F3EA',
    font_family: 'DM Serif Display',
    menu_pattern: 'seigaiha',
  },
  {
    id: 'cafe',
    venues: ['cafe'],
    primary_color: '#6F4E37',
    background_color: '#F6EFE7',
    font_family: 'Caveat',
    menu_pattern: 'dots',
  },
  {
    id: 'street',
    venues: ['street', 'bar'],
    primary_color: '#111111',
    background_color: '#FFD23F',
    font_family: 'Oswald',
    menu_pattern: 'dots',
  },
  {
    id: 'bistro',
    venues: ['restaurant', 'cafe'],
    primary_color: '#1E4D2B',
    background_color: '#FAF6EC',
    font_family: 'Playfair Display',
    menu_pattern: 'stripes',
  },
  {
    id: 'greek',
    venues: ['world', 'restaurant'],
    primary_color: '#1F5FAD',
    background_color: '#F6F9FC',
    font_family: 'Lora',
    menu_pattern: 'waves',
  },
  {
    id: 'cocktail',
    venues: ['bar', 'fine'],
    primary_color: '#FF5C8A',
    background_color: '#141A33',
    font_family: 'Josefin Sans',
    menu_pattern: 'terrazzo',
  },
  {
    id: 'vegan',
    venues: ['restaurant', 'cafe', 'street'],
    primary_color: '#2E7D32',
    background_color: '#F2F7EE',
    font_family: 'Nunito',
    menu_pattern: 'leaves',
  },
  {
    id: 'mexican',
    venues: ['world', 'street'],
    primary_color: '#C2185B',
    background_color: '#FFF3D6',
    font_family: 'Nunito',
    menu_pattern: 'stripes',
  },
  {
    id: 'karczma',
    venues: ['restaurant'],
    primary_color: '#9E2A2B',
    background_color: '#F3E9DC',
    font_family: 'Lora',
    menu_pattern: 'wood',
  },
  {
    id: 'patisserie',
    venues: ['cafe'],
    primary_color: '#D6336C',
    background_color: '#FFF0F5',
    font_family: 'Nunito',
    menu_pattern: 'terrazzo',
  },
  {
    id: 'seafood',
    venues: ['restaurant', 'world'],
    primary_color: '#0E7C86',
    background_color: '#F3F8F7',
    font_family: 'Montserrat',
    menu_pattern: 'waves',
  },
  {
    id: 'steakhouse',
    venues: ['fine', 'restaurant'],
    primary_color: '#C8743A',
    background_color: '#1C1C1E',
    font_family: 'DM Serif Display',
    menu_pattern: null,
  },
  {
    id: 'dark-elegance',
    venues: ['fine', 'bar'],
    primary_color: '#D4AF37',
    background_color: '#1A1A1A',
    font_family: 'Playfair Display',
    menu_pattern: null,
  },
  {
    id: 'vivid',
    venues: ['street', 'cafe'],
    primary_color: '#5B4CDB',
    background_color: '#F5F3FF',
    font_family: 'Montserrat',
    menu_pattern: null,
  },
];
