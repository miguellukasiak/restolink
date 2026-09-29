import { useEffect, useState } from 'react';
import { PHONE_ASPECT, PHONE_BEZEL } from '../components/panel/PhoneFrame';

interface FitOptions {
  /** Vertical space the layout needs around the phone, in px. */
  reserveY: number;
  /** Horizontal space around it — only binds on a narrow screen. */
  reserveX?: number;
  minWidth?: number;
  maxWidth?: number;
}

/** Below this the phone shortens rather than running off the screen. */
const MIN_SCREEN_HEIGHT = 420;

function readViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * A phone preview's size, fitted to the window.
 *
 * The whole device scales with the height it has — width and height together,
 * at a real phone's proportions — so the preview looks the same on a laptop at
 * 100% zoom as on a tall monitor, instead of a fixed-width frame whose screen
 * is squeezed to whatever height is left. Browser zoom changes the viewport
 * and fires `resize`, so zooming refits it too.
 */
export function useFittedPhone({
  reserveY,
  reserveX = 32,
  minWidth = 240,
  maxWidth = 360,
}: FitOptions) {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const available = viewport.height - reserveY;
  const width = Math.round(
    Math.min(
      viewport.width - reserveX,
      Math.max(minWidth, Math.min(maxWidth, available / PHONE_ASPECT)),
    ),
  );
  const outerHeight = Math.min(
    width * PHONE_ASPECT,
    Math.max(available, MIN_SCREEN_HEIGHT + PHONE_BEZEL * 2),
  );

  return { width, screenHeight: Math.round(outerHeight) - PHONE_BEZEL * 2 };
}
