/** Allergen checklist shown in the dish editor. */
export const ALLERGEN_OPTIONS = [
  'Gluten',
  'Laktoza',
  'Orzechy',
  'Jaja',
  'Soja',
  'Ryby',
  'Seler',
  'Gorczyca',
] as const;

/** Marketing / dietary tags shown in the dish editor. */
export const TAG_OPTIONS = [
  'Wegańskie',
  'Wegetariańskie',
  'Bestseller',
  'Pikantne',
  'Nowość',
] as const;

/** Font families offered in the visual settings page. */
export const FONT_OPTIONS = [
  { value: 'Roboto', stack: '"Roboto", "Segoe UI", Arial, sans-serif' },
  { value: 'Playfair Display', stack: '"Playfair Display", Georgia, serif' },
  { value: 'Montserrat', stack: '"Montserrat", "Segoe UI", Arial, sans-serif' },
] as const;

/** CSS font stack for a configured font family (falls back to Roboto). */
export function getFontStack(fontFamily?: string): string {
  return (
    FONT_OPTIONS.find((option) => option.value === fontFamily)?.stack ??
    FONT_OPTIONS[0].stack
  );
}

/** Quick-select brand color presets for the settings page. */
export const PRIMARY_COLOR_PRESETS = [
  '#8C1D18',
  '#5B4CDB',
  '#00696D',
  '#B26A00',
  '#1B5E20',
] as const;

/** Quick-select background presets (kept light for text contrast). */
export const BACKGROUND_COLOR_PRESETS = [
  '#FCF4F6',
  '#FFFFFF',
  '#F5F1E8',
  '#EFF4F8',
  '#F2F7F2',
] as const;

/** A guaranteed-readable brand combination applied in one tap on the settings page. */
export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  primary_color: string;
  background_color: string;
  font_family: string;
}

/**
 * One-tap "Gotowe motywy" — each is a hand-tuned, contrast-safe pairing so a
 * restaurant lands on a beautiful, readable menu without fiddling with hex codes.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'light-minimal',
    label: 'Jasny Minimalizm',
    description: 'Czysta biel, wyraziste akcenty',
    primary_color: '#1C1B1F',
    background_color: '#FFFFFF',
    font_family: 'Montserrat',
  },
  {
    id: 'dark-elegance',
    label: 'Ciemna Elegancja',
    description: 'Głęboka czerń ze złotem',
    primary_color: '#D4AF37',
    background_color: '#1A1A1A',
    font_family: 'Playfair Display',
  },
  {
    id: 'vivid-color',
    label: 'Wyrazisty Kolor',
    description: 'Energetyczny fiolet na jasnym tle',
    primary_color: '#5B4CDB',
    background_color: '#F5F3FF',
    font_family: 'Montserrat',
  },
] as const;

/** Formats a price in PLN with Polish conventions (e.g. "24,90 zł"). */
export function formatPln(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(value);
}
