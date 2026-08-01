import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { keyframes } from '@mui/material/styles';
import RamenDiningRoundedIcon from '@mui/icons-material/RamenDiningRounded';

/** Playful "kitchen at work" status lines, cycled while the menu loads. */
const LOADING_PHRASES = [
  'Polerujemy wirtualne sztućce...',
  'Zatrudniamy cyfrowych kelnerów...',
  'Podgrzewamy serwery do 200°C...',
  'Kroimy wirtualną cebulę (bez płaczu)...',
  'Układamy frytki w idealny wzór...',
  'Degustujemy kod źródłowy...',
  'Twoje dania już do Ciebie lecą!',
] as const;

/** How long each phrase stays before fading to the next. */
const PHRASE_INTERVAL_MS = 1500;

/** Gentle continuous bounce + squash for the centered dish icon. */
const bounce = keyframes`
  0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-12px) scale(1.06); }
  60% { transform: translateY(0) scale(0.97); }
`;

/**
 * "SimCity-style" loading splash for the public menu: a bouncing dish icon
 * inside a large spinner, with kitchen-themed status lines that cross-fade every
 * 1.5s — so a slow-network visitor feels entertained, not stalled. Rendered by
 * the live public page and (scaled) inside the appearance-settings preview.
 */
export function PublicMenuSkeleton() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Every tick, fade the current line out; the swap-in happens once the
  // fade-out transition actually finishes (see onTransitionEnd) so the text
  // never snaps and we don't juggle nested, leak-prone timers.
  useEffect(() => {
    const id = setInterval(() => setVisible(false), PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const handleFadeEnd = () => {
    if (!visible) {
      setPhraseIndex((index) => (index + 1) % LOADING_PHRASES.length);
      setVisible(true);
    }
  };

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={LOADING_PHRASES[phraseIndex]}
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
      {/* Spinner (active fetching) with the bouncing dish icon at its center. */}
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
          <RamenDiningRoundedIcon
            sx={{
              fontSize: 48,
              color: 'primary.main',
              animation: `${bounce} 1.4s ease-in-out infinite`,
            }}
          />
        </Box>
      </Box>

      {/* Cross-fading kitchen status line. */}
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
        {LOADING_PHRASES[phraseIndex]}
      </Typography>
    </Box>
  );
}
