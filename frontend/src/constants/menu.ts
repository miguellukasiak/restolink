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

/** Formats a price in PLN with Polish conventions (e.g. "24,90 zł"). */
export function formatPln(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(value);
}
