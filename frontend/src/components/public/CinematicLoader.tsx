import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, keyframes } from '@mui/material/styles';
import { recallMenuTheme } from '../../utils/menuThemeMemory';
import { getContrastingTextColor } from '../../utils/colors';
import { SPLASH_EXIT_MS } from '../../hooks/useSplashPhase';

/**
 * The ground for a guest who has never opened this menu before.
 *
 * Dark on purpose, and this does *not* contradict the skeleton's theme-matching
 * rule. A skeleton imitates the page, so it has to share its colours or the
 * swap flashes. A splash is a curtain — it is meant to be its own thing and
 * then leave. Anyone who has opened the menu before gets their restaurant's
 * actual colour from `menuThemeMemory`, so the curtain and the stage match.
 */
const FALLBACK_BACKGROUND = '#111111';

/** The ring breathing: never fully still, never distracting. */
const breathe = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50%      { transform: scale(1.12); opacity: 1; }
`;

/** A slow counter-rotation, so the glow travels around the ring. */
const drift = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

/**
 * The exit: the ring rushes the camera and blows past it.
 *
 * `forwards` is correct *here*, unlike everywhere else in this file's sibling
 * `reveal.ts`. This element is being removed either way — the unmount runs on a
 * timer — so holding the final frame only prevents a one-frame snap back to
 * full size just before it disappears.
 */
const rushPast = keyframes`
  to { transform: scale(20); opacity: 0; }
`;

const dissolve = keyframes`
  to { opacity: 0; }
`;

interface CinematicLoaderProps {
  restaurantId: string;
  /** True once the menu has arrived and the curtain should pull away. */
  exiting: boolean;
}

/**
 * Full-screen splash for the public menu.
 *
 * Replaces a page-shaped skeleton on the guest-facing route only. The settings
 * preview keeps the skeleton: this is `position: fixed`, so inside the panel's
 * phone mock it would escape the frame and cover the whole admin page.
 */
export function CinematicLoader({ restaurantId, exiting }: CinematicLoaderProps) {
  const { t } = useTranslation();

  const remembered = recallMenuTheme(restaurantId);
  const background = remembered?.background_color ?? FALLBACK_BACKGROUND;

  // The same luminance guardrail the menu itself uses. Without it a white ring
  // on a remembered cream background would be invisible — the splash would look
  // broken for exactly the restaurants whose menus are light.
  const onBackground = getContrastingTextColor(background, {
    light: '#FFFFFF',
    dark: '#1A1A1A',
  });
  const accent = remembered?.primary_color ?? onBackground;

  return (
    <Box
      role="status"
      aria-busy={!exiting}
      aria-label={t('loaderTagline')}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        bgcolor: background,
        // Stops taps landing on the splash once it starts dissolving, so a guest
        // who sees the menu underneath can already touch it.
        pointerEvents: exiting ? 'none' : 'auto',
        ...(exiting
          ? { animation: `${dissolve} ${SPLASH_EXIT_MS}ms ease-in forwards` }
          : {}),
      }}
    >
      {/* The ring. Two layers: a soft outer glow that breathes, and a hairline
          circle with one brighter arc that drifts around it. */}
      <Box
        aria-hidden
        sx={{
          position: 'relative',
          width: 96,
          height: 96,
          display: 'grid',
          placeItems: 'center',
          ...(exiting
            ? {
                animation: `${rushPast} ${SPLASH_EXIT_MS}ms cubic-bezier(0.7, 0, 0.84, 0) forwards`,
              }
            : {}),
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: `0 0 60px 6px ${alpha(accent, 0.35)}`,
            bgcolor: alpha(accent, 0.04),
            animation: exiting ? 'none' : `${breathe} 2.8s ease-in-out infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1px solid',
            borderColor: alpha(onBackground, 0.18),
            // A single brighter arc, revealed by colouring one edge only.
            borderTopColor: accent,
            animation: exiting ? 'none' : `${drift} 2.2s linear infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />
      </Box>

      {/* Micro-typography, pinned to the bottom edge. */}
      <Typography
        component="p"
        sx={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.3em',
          // The tracking pushes the text right; half an em back re-centres it.
          textIndent: '0.3em',
          textTransform: 'uppercase',
          color: onBackground,
          opacity: 0.5,
          ...(exiting
            ? { animation: `${dissolve} 300ms ease-in forwards` }
            : {}),
        }}
      >
        {t('loaderTagline')}
      </Typography>
    </Box>
  );
}
