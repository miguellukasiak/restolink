import { useEffect, useRef, useState } from 'react';

/**
 * Applies an entrance animation for exactly as long as it should run, then
 * takes it off the element entirely.
 *
 * This exists because of a failure that looks impossible until you hit it. An
 * entrance animation written as `from { opacity: 0 }` with no `forwards` fill
 * is supposed to be safe: once it ends, the resting style — visible — applies.
 * But browsers *pause* CSS animations in a hidden tab rather than running them
 * unpainted, and a paused animation holds its first frame indefinitely. The
 * element sits at `opacity: 0` for as long as the tab stays hidden. Measured on
 * this menu: the splash unmounted on its timer, the menu mounted with forty
 * dish cards, and the whole page computed to `opacity: 0; filter: blur(10px)`.
 *
 * A timer does not care whether frames are being painted. Once it fires, the
 * animation is removed from the style object and the element falls back to its
 * plain, visible rules — whether the animation ever played or not.
 */
export function useAnimationWindow(durationMs: number, start = true): boolean {
  const [active, setActive] = useState(false);
  // One-shot: re-running would restart an entrance the guest already saw.
  const finished = useRef(false);

  useEffect(() => {
    if (!start || finished.current) return;

    setActive(true);
    const id = window.setTimeout(() => {
      finished.current = true;
      setActive(false);
    }, durationMs);

    return () => window.clearTimeout(id);
  }, [start, durationMs]);

  return active;
}
