import { createTheme, alpha } from '@mui/material/styles';

/**
 * Material Design 3 inspired theme: generous corner radii, soft layered
 * shadows, tonal surfaces and a confident type scale.
 *
 * The palette is taken from the landing page rather than invented here. That
 * page is what a restaurateur sees first, and until now the app contradicted
 * it twice over — a blue-violet primary on the login and admin screens, a teal
 * secondary in the owner panel — so the product changed colour twice between
 * the marketing site and the panel someone signs into. These values are the
 * same tokens `landing-page/src/style.css` declares for Tailwind.
 */

/** `--color-brand-600`, the landing page's CTA button. The brand colour. */
const BRAND = '#0F8256';
/** `--color-brand-700`, its hover state. */
const BRAND_DARK = '#0C6544';
/** `--color-brand-500`, the lighter step. */
const BRAND_LIGHT = '#16A06A';

/** `--color-ink-900` / `--color-ink-500` from the same file. */
const INK = '#161C25';
const INK_MUTED = '#4B5563';

/**
 * The brand wordmark face, loaded in `index.html`.
 *
 * Only the logo uses it. It is a display face with one weight and no italic —
 * excellent at 20px as a name, unreadable as a paragraph — so it is deliberately
 * kept out of the body stack rather than added to `typography.fontFamily`.
 */
export const BRAND_FONT_FAMILY =
  "'Dela Gothic One', 'Roboto', 'Segoe UI', sans-serif";

/**
 * Corner radii, as px strings.
 *
 * Strings on purpose: a bare number in `sx` (`borderRadius: 3`) is a
 * *multiplier* of `shape.borderRadius`, so 3 meant 42px — which is how the
 * menu builder's dish cards ended up as pills around two lines of text, and
 * why its checkbox cards had 56px corners. Reach for these instead.
 *
 * Nested surfaces follow outer − padding: a 24px section with 8px of padding
 * holds 16px rows, and a 16px row with 8px of padding holds 8px thumbnails,
 * so the curves stay concentric instead of fighting each other.
 */
export const radii = {
  /** Chips, thumbnails inside rows, small badges. */
  xs: '8px',
  /** Inputs, alerts, small tiles. */
  sm: '12px',
  /** Rows, photo tiles, cards nested inside a section. */
  md: '16px',
  /** Sections and standalone cards. */
  lg: '24px',
  /** Dialogs. */
  xl: '28px',
  pill: '999px',
} as const;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND, light: BRAND_LIGHT, dark: BRAND_DARK },
    // A lighter step of the same green rather than the old teal. The owner
    // panel uses this for its tonal navigation, so it still reads as a
    // different surface from the admin panel without leaving the brand.
    secondary: { main: BRAND_LIGHT, light: '#4EC08F', dark: BRAND_DARK },
    success: { main: '#2E7D32' },
    error: { main: '#C62828' },
    warning: { main: '#ED6C02' },
    // Neutral, not the previous violet-tinted off-white: a login screen that
    // tints its background toward the brand fights the card sitting on it.
    background: { default: '#F7F9FA', paper: '#FFFFFF' },
    text: { primary: INK, secondary: INK_MUTED },
    divider: alpha(INK, 0.08),
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        elevation1: { boxShadow: `0 2px 12px ${alpha(INK, 0.06)}` },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: `0 4px 24px ${alpha(INK, 0.06)}`,
          border: `1px solid ${alpha(INK, 0.06)}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radii.xl,
          boxShadow: `0 24px 64px ${alpha(INK, 0.18)}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 20 },
        // Tinted to the brand, the way the landing page's CTA carries a green
        // glow rather than a grey drop shadow.
        contained: {
          boxShadow: `0 4px 14px ${alpha(BRAND, 0.35)}`,
          '&:hover': { boxShadow: `0 6px 18px ${alpha(BRAND, 0.45)}` },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#FFFFFF', 0.85),
          backdropFilter: 'blur(12px)',
          color: INK,
          boxShadow: `inset 0 -1px 0 ${alpha(INK, 0.08)}`,
        },
      },
    },
  },
});
