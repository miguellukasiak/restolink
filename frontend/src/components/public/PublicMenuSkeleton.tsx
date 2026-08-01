import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { keyframes } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import RoomServiceRoundedIcon from '@mui/icons-material/RoomServiceRounded';
import LocalPizzaRoundedIcon from '@mui/icons-material/LocalPizzaRounded';
import SoupKitchenRoundedIcon from '@mui/icons-material/SoupKitchenRounded';
import FastfoodRoundedIcon from '@mui/icons-material/FastfoodRounded';
import RamenDiningRoundedIcon from '@mui/icons-material/RamenDiningRounded';
import DeliveryDiningRoundedIcon from '@mui/icons-material/DeliveryDiningRounded';

interface LoadingStep {
  text: string;
  /** Icon shown (and cross-faded) alongside this line — matched to its theme. */
  Icon: SvgIconComponent;
}

/**
 * Playful "kitchen at work" status lines, each paired with a contextual icon
 * (cutlery, oven, delivery scooter…). Cycled while the menu loads.
 */
const LOADING_STEPS: LoadingStep[] = [
  { text: 'Polerujemy wirtualne sztućce...', Icon: RestaurantRoundedIcon },
  { text: 'Zatrudniamy cyfrowych kelnerów...', Icon: RoomServiceRoundedIcon },
  { text: 'Podgrzewamy serwery do 200°C...', Icon: LocalPizzaRoundedIcon },
  { text: 'Kroimy wirtualną cebulę (bez płaczu)...', Icon: SoupKitchenRoundedIcon },
  { text: 'Układamy frytki w idealny wzór...', Icon: FastfoodRoundedIcon },
  { text: 'Degustujemy kod źródłowy...', Icon: RamenDiningRoundedIcon },
  { text: 'Twoje dania już do Ciebie lecą!', Icon: DeliveryDiningRoundedIcon },
];

/** How long each step stays before fading to the next. */
const PHRASE_INTERVAL_MS = 1500;

/** Gentle continuous bounce + squash for the centered icon. */
const bounce = keyframes`
  0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-12px) scale(1.06); }
  60% { transform: translateY(0) scale(0.97); }
`;

/**
 * "SimCity-style" loading splash for the public menu: a bouncing, context-aware
 * icon inside a large spinner, with kitchen-themed status lines that cross-fade
 * every 1.5s — so a slow-network visitor feels entertained, not stalled. The
 * icon swaps in lockstep with its phrase. Rendered by the live public page and
 * (scaled) inside the appearance-settings preview.
 */
export function PublicMenuSkeleton() {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Every tick, fade the current step out; the swap-in happens once the
  // fade-out transition actually finishes (see onTransitionEnd) so the text +
  // icon never snap and we don't juggle nested, leak-prone timers.
  useEffect(() => {
    const id = setInterval(() => setVisible(false), PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const handleFadeEnd = () => {
    if (!visible) {
      setStepIndex((index) => (index + 1) % LOADING_STEPS.length);
      setVisible(true);
    }
  };

  const { text, Icon } = LOADING_STEPS[stepIndex];

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={text}
      sx={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        px: 3,
        textAlign: 'center',
        bgcolor: 'background.default',
      }}
    >
      {/* Spinner (active fetching) with the bouncing, context-aware icon at its
          center — the icon fades on the same `visible` state as the text below,
          so they cross-fade together. */}
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress size={104} thickness={2.4} sx={{ color: 'primary.main' }} />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            sx={{
              fontSize: 48,
              color: 'primary.main',
              animation: `${bounce} 1.4s ease-in-out infinite`,
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />
        </Box>
      </Box>

      {/* Cross-fading kitchen status line (drives the swap for both text + icon). */}
      <Typography
        variant="h6"
        component="p"
        onTransitionEnd={handleFadeEnd}
        sx={{
          maxWidth: 340,
          minHeight: '2.5em',
          fontWeight: 600,
          color: 'text.secondary',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}
