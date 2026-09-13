import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long to ignore the observer after the guest taps a chip.
 *
 * Tapping "Desserts" starts a 400ms smooth scroll that sweeps through every
 * section in between, and each one would briefly claim to be the active
 * category — the chip bar would flicker through three highlights before
 * settling. Suppressing the spy until the scroll has landed removes that
 * entirely, and 700ms leaves margin for a slow frame.
 */
const SPY_LOCK_MS = 700;

/**
 * The band, relative to the viewport, that decides which category is "current".
 *
 * The top inset clears the sticky header, so a heading hidden behind it does
 * not count as visible. The bottom inset is large because without it every
 * section on a tall screen intersects at once and the *last* one wins — the
 * band has to be narrow enough that only what is genuinely at the top of the
 * reading area qualifies.
 */
const SPY_ROOT_MARGIN = '-120px 0px -70% 0px';

interface ScrollSpy {
  /** The category the guest is currently looking at. */
  activeId: string | null;
  /** Call when the guest picks a category, before scrolling to it. */
  selectCategory: (categoryId: string) => void;
}

/**
 * Tracks which category section is at the top of the viewport.
 *
 * Watches the elements `react-scroll` already renders for each category — the
 * ones the chips scroll to — so nothing extra needs to be wired into the menu
 * markup beyond the ids that were there anyway.
 */
export function useCategoryScrollSpy(categoryIds: string[]): ScrollSpy {
  const [activeId, setActiveId] = useState<string | null>(null);
  const lockedUntil = useRef(0);

  // Joined rather than passed as an array: a new array identity on every render
  // would tear down and rebuild the observer each time the menu re-renders,
  // which a search keystroke does on every character.
  const key = categoryIds.join('|');

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    if (ids.length === 0) {
      setActiveId(null);
      return;
    }

    setActiveId((current) => (current && ids.includes(current) ? current : ids[0]!));

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const elements = ids
      .map((id) => ({ id, element: document.getElementById(id) }))
      .filter((entry): entry is { id: string; element: HTMLElement } =>
        Boolean(entry.element),
      );
    if (elements.length === 0) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }

        // A tap is in flight; its destination already won.
        if (Date.now() < lockedUntil.current) return;

        // Document order, so when two sections share the band the upper one —
        // the one the guest is actually reading — wins.
        const topmost = ids.find((id) => visible.has(id));
        if (topmost) setActiveId(topmost);
      },
      { rootMargin: SPY_ROOT_MARGIN, threshold: 0 },
    );

    elements.forEach(({ element }) => observer.observe(element));
    return () => observer.disconnect();
  }, [key]);

  const selectCategory = useCallback((categoryId: string) => {
    lockedUntil.current = Date.now() + SPY_LOCK_MS;
    setActiveId(categoryId);
  }, []);

  return { activeId, selectCategory };
}
