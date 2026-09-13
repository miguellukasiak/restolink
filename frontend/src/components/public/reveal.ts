import { keyframes } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Entrance animations for the public menu.
 *
 * All of them are written with a `from` frame only, and **no `forwards` fill**.
 * That is deliberate and load-bearing: the element's resting style is the
 * visible one, so if the animation never runs — a backgrounded tab, a browser
 * that skips it, a rendering loop that is not ticking — the content is simply
 * *there* rather than stuck at `opacity: 0` behind a blur. An entrance effect
 * must never be able to make a menu unreadable.
 */

const fadeIn = keyframes`
  from { opacity: 0; }
`;

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
`;

/**
 * The camera finding focus: the menu resolves out of a soft blur as the splash
 * pulls away over it. Slightly longer than the splash's own exit so the two
 * overlap rather than hand off in sequence, which is what makes it read as one
 * movement instead of two.
 */
const focusPull = keyframes`
  from { opacity: 0; filter: blur(10px); transform: scale(1.02); }
`;

/** Durations, exported so `useAnimationWindow` cannot drift out of step
 *  with the animation it is guarding. */
export const REVEAL_MS = 400;
export const REVEAL_HEADER_MS = 320;
export const REVEAL_FOCUS_PULL_MS = 700;

/** Whole-page fade, used where a plain reveal is wanted. */
export const revealSx: SxProps<Theme> = {
  animation: `${fadeIn} ${REVEAL_MS}ms ease-out`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};

/**
 * A shorter, slightly-lifted entrance for the header.
 *
 * Runs a touch faster than the page reveal and with a small upward travel, so
 * the bar settles first and the menu resolves underneath it — the ordering
 * premium apps use to make a screen feel assembled rather than pasted.
 */
export const revealHeaderSx: SxProps<Theme> = {
  animation: `${riseIn} ${REVEAL_HEADER_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};

/** The focus-pull reveal, paired with the splash screen's exit. */
export const revealFocusPullSx: SxProps<Theme> = {
  animation: `${focusPull} ${REVEAL_FOCUS_PULL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  // A blur on a full page is expensive to composite; promoting it once is
  // cheaper than letting the compositor rediscover that on every frame.
  willChange: 'opacity, filter',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};
