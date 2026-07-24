import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { getFontStack } from '../../constants/menu';
import type { RestaurantThemeUpdate } from '../../types';

/**
 * Builds the public-menu theme from injectable brand settings — primary color,
 * background color, and font family all come from the restaurant's saved
 * configuration (or the settings-page live preview).
 */
export function createRestaurantTheme(settings: RestaurantThemeUpdate = {}) {
  const fontStack = getFontStack(settings.font_family ?? undefined);
  const headingStack =
    settings.font_family && settings.font_family !== 'Roboto'
      ? fontStack
      : 'Georgia, "Times New Roman", serif';

  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: settings.primary_color ?? '#8C1D18' },
      secondary: { main: '#6D5E4F' },
      background: {
        default: settings.background_color ?? '#FCF4F6',
        paper: '#FFFFFF',
      },
      text: { primary: '#211A1B', secondary: '#655C5E' },
      divider: alpha('#211A1B', 0.08),
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: fontStack,
      h4: { fontFamily: headingStack, fontWeight: 700 },
      h5: { fontFamily: headingStack, fontWeight: 700 },
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
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

  const theme = useMemo(
    () => createRestaurantTheme(menu.data?.restaurant.theme),
    [menu.data?.restaurant.theme],
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
