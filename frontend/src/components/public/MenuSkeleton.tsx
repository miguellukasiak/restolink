import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

/** Matches the real chip bar: four categories is a typical menu. */
const CHIP_WIDTHS = [86, 104, 72, 92];

/** Two rows of the two-up grid — enough to fill a phone without overshooting. */
const CARD_COUNT = 6;

/**
 * Page-shaped loading state for the public menu.
 *
 * Replaces a centred spinner with rotating captions. A spinner says only "wait";
 * a skeleton in the shape of the page tells the guest what is coming and where
 * it will be, so the menu appears to assemble rather than to pop into being.
 *
 * **Colours come from the theme, never from constants.** This view is rendered
 * inside `RestaurantThemeProvider`, so its ground is whatever the restaurant
 * chose — and a hardcoded dark panel, which is the obvious way to "avoid a white
 * flash", would produce exactly that flash in reverse for the majority of
 * restaurants, whose menus are light. `RestaurantThemeProvider` seeds itself
 * from the last-known theme (see `menuThemeMemory`), so on any visit after the
 * first this already paints in the restaurant's own colours.
 *
 * Shared with the appearance-settings preview, which shows the same shape while
 * its own first fetch resolves.
 */
export function MenuSkeleton() {
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label="Wczytywanie menu"
      sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}
    >
      {/* Header: logo, then the two icon buttons the collapsed header carries. */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: (theme) => alpha(theme.palette.background.default, 0.92),
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: 1.5 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', py: 1 }}>
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flexGrow: 1 }} />
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>

          {/* Chip bar. `overflow: hidden` rather than `auto`: there is nothing
              to scroll to yet, and a scrollbar-less strip that cannot move is
              closer to what the loaded bar feels like. */}
          <Box sx={{ display: 'flex', gap: 0.75, pb: 1, px: 0.25, overflow: 'hidden' }}>
            {CHIP_WIDTHS.map((width, index) => (
              <Skeleton
                key={index}
                variant="rounded"
                width={width}
                height={32}
                sx={{ borderRadius: '999px', flexShrink: 0 }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 1.5, pb: 6 }}>
        <Box sx={{ pt: 2.5 }}>
          {/* Category heading, matching the loaded 17/20px weight-700 line. */}
          <Skeleton variant="text" width={148} height={26} sx={{ mb: 1 }} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            {Array.from({ length: CARD_COUNT }).map((_, index) => (
              <Box key={index}>
                {/* Square photo with only its top corners rounded — the exact
                    shape of the real card, so nothing shifts on swap. */}
                <Skeleton
                  variant="rectangular"
                  sx={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '16px 16px 0 0',
                  }}
                />
                <Box sx={{ px: 1, pt: 0.75, pb: 1 }}>
                  <Skeleton variant="text" width="85%" height={18} />
                  <Skeleton variant="text" width="60%" height={14} />
                  <Skeleton variant="text" width="40%" height={18} sx={{ mt: 0.5 }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
