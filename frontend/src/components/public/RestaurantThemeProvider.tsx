import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha, lighten } from '@mui/material/styles';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { fontStack, getFontPairing } from '../../constants/menuStyle';
import { getContrastingTextColor, isDarkColor } from '../../utils/colors';
import { recallMenuTheme, rememberMenuTheme } from '../../utils/menuThemeMemory';
import type { RestaurantThemeUpdate } from '../../types';
import { patternCss } from './menuPatterns';

/**
 * Menu-only extras carried on the restaurant theme, so every surface that
 * renders a menu (the guest page, the panel's previews) reads them the same
 * way instead of each being handed the settings separately.
 */
export interface MenuDecor {
  /** Background pattern as CSS, or null for a plain background. */
  pattern: { backgroundImage: string; backgroundSize: string } | null;
  /** Dish cards on a solid surface — always, when a pattern is behind them. */
  cards: boolean;
  /** Multiplier for category-heading sizes (see FontPairing.headingScale). */
  headingScale: number;
}

declare module '@mui/material/styles' {
  interface Theme {
    menuDecor: MenuDecor;
  }
  interface ThemeOptions {
    menuDecor?: MenuDecor;
  }
}

/**
 * Builds the public-menu theme from injectable brand settings — primary color,
 * background color, and font family all come from the restaurant's saved
 * configuration (or the settings-page live preview).
 */
export function createRestaurantTheme(settings: RestaurantThemeUpdate = {}) {
  // A display face for headings, a readable one for everything else (see
  // FONT_PAIRINGS). "Roboto", the original default, keeps its serif headings.
  const pairing = getFontPairing(settings.font_family);
  const bodyStack = fontStack(pairing.body.family);
  const headingStack = fontStack(pairing.heading.family);
  const heading = { fontFamily: headingStack, fontWeight: pairing.heading.weight };

  // Readability guardrail: derive every on-background color from the chosen
  // background's luminance, so a dark background automatically flips text (and
  // dividers/surfaces) to light — a restaurant can't create a dark-on-dark,
  // unreadable menu. See utils/colors.ts.
  const backgroundColor = settings.background_color ?? '#FCF4F6';
  const dark = isDarkColor(backgroundColor);
  const onBackground = getContrastingTextColor(backgroundColor, {
    light: '#FFFFFF',
    dark: '#211A1B',
  });

  const primaryColor = settings.primary_color ?? '#8C1D18';
  const pattern = patternCss(settings.menu_pattern, primaryColor, dark);

  return createTheme({
    menuDecor: {
      pattern,
      cards: pattern !== null,
      headingScale: pairing.headingScale ?? 1,
    },
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: primaryColor },
      secondary: { main: dark ? '#CBB9A6' : '#6D5E4F' },
      background: {
        default: backgroundColor,
        // A step lighter than a dark background, in its own hue — a fixed
        // grey card looked out of place on warm dark wood.
        paper: dark ? lighten(backgroundColor, 0.07) : '#FFFFFF',
      },
      text: {
        primary: onBackground,
        secondary: alpha(onBackground, dark ? 0.7 : 0.62),
      },
      divider: alpha(onBackground, dark ? 0.16 : 0.08),
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: bodyStack,
      h4: heading,
      h5: heading,
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiTypography: {
        styleOverrides: {
          // Each paragraph takes its direction from its own text, so a dish
          // in Arabic or Hebrew reads and aligns right to left while the
          // layout around it — and every Polish or English line — stays as
          // it is. Covers dialogs too, which render outside the page.
          root: { unicodeBidi: 'plaintext' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            boxShadow: '0 2px 16px rgba(33, 26, 27, 0.07)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 10 },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 999 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 28 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 999 },
        },
      },
    },
  });
}

/**
 * Wraps the public client routes in a restaurant-specific MUI theme, fully
 * isolated from the Admin/Panel theme. Reads the restaurant id from the URL
 * and the brand color from the public menu payload (deduped with the page's
 * own query by React Query).
 */
export function RestaurantThemeProvider({ children }: { children: ReactNode }) {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const menu = usePublicMenu(restaurantId);
  const { i18n } = useTranslation();

  // Keep `<html lang>` in step with the menu's language. Without this a German
  // menu stays labelled Polish, and a screen reader pronounces every dish name
  // with Polish phonetics — which is precisely the guest this feature exists
  // for. Scoped here because this provider wraps only the public menu route:
  // the owner's panel is Polish regardless of what a guest last picked.
  const language = i18n.resolvedLanguage ?? i18n.language;
  useEffect(() => {
    if (!language) return;
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = language.split('-')[0] ?? previous;
    return () => {
      root.lang = previous;
    };
  }, [language]);

  const loaded = menu.data?.restaurant.theme;

  // Remember what this restaurant looks like, so the next visit can paint its
  // colours before the payload arrives.
  useEffect(() => {
    if (loaded) rememberMenuTheme(restaurantId, loaded);
  }, [restaurantId, loaded]);

  const theme = useMemo(
    // While loading, fall back to the last theme we saw rather than the global
    // default. That is what stops a dark restaurant's menu from flashing light
    // — the skeleton and the page behind it start in the right colours.
    () => createRestaurantTheme(loaded ?? recallMenuTheme(restaurantId)),
    [loaded, restaurantId],
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
