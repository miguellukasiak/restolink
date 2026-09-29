import { useMemo } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import type { PublicMenuItem, RestaurantThemeSettings } from '../../types';
import { radii } from '../../theme';
import { createRestaurantTheme } from '../public/RestaurantThemeProvider';
import { PublicItemCard } from '../public/PublicItemCard';
import { DishDetailBody } from '../public/ItemDetailModal';

interface GuestDishPreviewProps {
  /** The dish as currently typed, unsaved. */
  dish: PublicMenuItem;
  /** The next dish in the same category, shown beside it for scale. */
  neighbour: PublicMenuItem | null;
  categoryName: string;
  /** The restaurant's colours and font; the panel's defaults until loaded. */
  menuTheme?: RestaurantThemeSettings;
}

function PreviewLabel({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: 'center', color: 'text.secondary', mb: 1 }}
    >
      {icon}
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
        {children}
      </Typography>
    </Stack>
  );
}

/**
 * The dish editor's right-hand pane: the dish exactly as a guest will meet it,
 * redrawn on every keystroke — first as a card in its category, then as the
 * detail sheet that opens on a tap. Both are the guest menu's own components
 * under the restaurant's own theme, so there is nothing to drift out of step.
 */
export function GuestDishPreview({
  dish,
  neighbour,
  categoryName,
  menuTheme,
}: GuestDishPreviewProps) {
  const restaurantTheme = useMemo(
    () =>
      createRestaurantTheme({
        primary_color: menuTheme?.primary_color,
        background_color: menuTheme?.background_color,
        font_family: menuTheme?.font_family,
      }),
    [menuTheme?.primary_color, menuTheme?.background_color, menuTheme?.font_family],
  );

  // Hidden from assistive tech: it repeats, as pictures, exactly what the
  // form beside it already says, and a screen reader would read it twice.
  return (
    <Stack spacing={2.5} aria-hidden>
      <Box>
        <PreviewLabel icon={<ViewModuleRoundedIcon sx={{ fontSize: 16 }} />}>
          W MENU
        </PreviewLabel>
        <ThemeProvider theme={restaurantTheme}>
          <Box
            sx={{
              bgcolor: 'background.default',
              color: 'text.primary',
              borderRadius: radii.lg,
              p: 1.5,
              boxShadow: '0 8px 24px rgba(22, 28, 37, 0.10)',
            }}
          >
            <Typography
              component="p"
              sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', mb: 1 }}
              noWrap
            >
              {categoryName}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 1.5,
                alignItems: 'stretch',
              }}
            >
              <PublicItemCard item={dish} />
              {neighbour ? (
                <Box sx={{ opacity: 0.45 }}>
                  <PublicItemCard item={neighbour} />
                </Box>
              ) : (
                <Box
                  sx={{
                    borderRadius: '16px',
                    border: '1.5px dashed',
                    borderColor: 'divider',
                  }}
                />
              )}
            </Box>
          </Box>
        </ThemeProvider>
      </Box>

      <Box>
        <PreviewLabel icon={<TouchAppRoundedIcon sx={{ fontSize: 16 }} />}>
          PO KLIKNIĘCIU
        </PreviewLabel>
        <ThemeProvider theme={restaurantTheme}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: radii.lg,
              p: 2.5,
              color: 'text.primary',
              boxShadow: '0 8px 24px rgba(22, 28, 37, 0.10)',
            }}
          >
            <DishDetailBody item={dish} idPrefix="dish-preview" />
          </Paper>
        </ThemeProvider>
      </Box>
    </Stack>
  );
}
