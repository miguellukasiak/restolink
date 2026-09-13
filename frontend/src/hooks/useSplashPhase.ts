import { useEffect, useRef, useState } from 'react';

/** How long the exit animation runs before the splash leaves the DOM. */
export const SPLASH_EXIT_MS = 600;

/**
 * Shortest time the splash stays up once it has been shown.
 *
 * Without it, a warm cache resolves in twenty milliseconds and the splash
 * becomes a strobe — a dark rectangle that blinks and is gone, which reads as a
 * glitch rather than as an intro. Holding it briefly is what makes the whole
 * thing look deliberate. It only ever applies when the splash was going to be
 * shown at all.
 */
const MIN_VISIBLE_MS = 450;

interface SplashPhase {
  /** Whether the splash should be in the DOM at all. */
  visible: boolean;
  /** Whether it is playing its exit — scale-up, fade-out. */
  exiting: boolean;
}

/**
 * Drives the splash screen's lifecycle: shown, exiting, gone.
 *
 * The unmount is scheduled on a timer rather than hung off `animationend`, and
 * that is not a stylistic preference. Animation events only fire when the page
 * is actually painting frames; a tab restored into the background, or any
 * browser that throttles animation, would never emit one — and the splash is a
 * fixed, full-screen overlay, so failing to remove it would leave the menu
 * covered by an opaque panel. A timer fires regardless.
 */
export function useSplashPhase(ready: boolean): SplashPhase {
  // Starts hidden when the data is already cached: a returning guest should get
  // their menu, not an intro they have seen before.
  const [visible, setVisible] = useState(!ready);
  const [exiting, setExiting] = useState(false);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    if (!ready) return;

    const elapsed = Date.now() - shownAt.current;
    const hold = Math.max(0, MIN_VISIBLE_MS - elapsed);

    const startExit = window.setTimeout(() => setExiting(true), hold);
    const unmount = window.setTimeout(
      () => setVisible(false),
      hold + SPLASH_EXIT_MS,
    );

    return () => {
      window.clearTimeout(startExit);
      window.clearTimeout(unmount);
    };
  }, [ready]);

  return { visible, exiting };
}
