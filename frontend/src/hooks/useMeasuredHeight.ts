import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The natural (untransformed) height of an element, kept up to date.
 *
 * For previews that lay a page out at full size and shrink it with
 * `transform: scale`: a transform does not change layout, so the scaled
 * content would still claim its full height and leave dead scroll space
 * beneath it. Measuring the real height lets the wrapper be sized to
 * `height × scale` explicitly — the reliable alternative to `zoom`, which in
 * some engines lets `position: sticky` children escape an `overflow: hidden`
 * clip.
 *
 * `measureKey` must be a primitive: it re-runs the effect when the element
 * may have been swapped out without resizing.
 */
export function useMeasuredHeight<T extends HTMLElement = HTMLDivElement>(
  measureKey: string | number | boolean | null | undefined,
) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // `offsetHeight` ignores the element's own transform and reports its true
    // layout height — getBoundingClientRect() would return the already-scaled
    // size and double-scale the wrapper.
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Images decode async and grow the layout after the first measurement —
    // re-measure a few times on a plain timer (not rAF, which a hidden tab
    // never runs) so the wrapper always catches up with the content.
    const timeouts = [50, 150, 300, 600, 1200].map((delay) => setTimeout(measure, delay));
    return () => {
      observer.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, [measureKey]);

  return { ref, height };
}
