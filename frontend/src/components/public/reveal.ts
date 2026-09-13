import { keyframes } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Entrance animations for the public menu.
 *
 * Both are written with a `from` frame only, and **no `forwards` fill**. That is
 * deliberate: the element's resting style is the visible one, so if the
 * animation never runs — a backgrounded tab, a browser that skips it, a
 * rendering loop that is not ticking — the content is simply *there* rather
 * than stuck at `opacity: 0`. An entrance effect must never be able to make a
 * menu invisible.
 */

const fadeIn = keyframes`
  from { opacity: 0; }
`;

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
`;

/** Whole-page fade, for the swap from skeleton to menu. */
export const revealSx: SxProps<Theme> = {
  animation: `${fadeIn} 400ms ease-out`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};

/**
 * A shorter, slightly-lifted entrance for the header.
 *
 * Runs a touch faster than the page fade and with a small upward travel, so the
 * bar settles first and the menu resolves underneath it — the ordering premium
 * apps use to make a screen feel assembled rather than pasted.
 */
export const revealHeaderSx: SxProps<Theme> = {
  animation: `${riseIn} 320ms cubic-bezier(0.22, 1, 0.36, 1)`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};
