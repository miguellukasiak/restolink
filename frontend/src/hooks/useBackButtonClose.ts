import { useEffect, useRef } from 'react';

/**
 * Maps the browser/hardware **Back** button (and the mobile back-swipe gesture)
 * to a modal's close handler — the behaviour every native app has, so a QR-code
 * visitor who opens a dish and swipes back just closes the sheet instead of
 * unloading the whole page back to their camera.
 *
 * How it works: while `open`, we push a throwaway history entry. Pressing Back
 * pops *that* entry (the visitor stays on the menu) and fires `popstate`, where
 * we invoke `onClose`. Closing through the UI (X / backdrop / Esc) instead
 * unwinds the entry we added, so the history stack always stays balanced and
 * the next Back press behaves normally. No confirm prompts — silent by design.
 *
 * `onClose` is read through a ref so a fresh inline handler on every render
 * doesn't retrigger the effect; it keys only on `open`.
 */
export function useBackButtonClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // Tag the entry so cleanup only ever unwinds one we actually pushed.
    window.history.pushState({ __modalTrap: true }, '');

    const handlePopState = () => {
      // Back pressed: the browser already removed our entry — just close.
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Closed via the UI rather than Back: our pushed entry is still on top,
      // so remove it. (After a real Back press it's already gone, and
      // history.state is no longer ours, so we skip this and never double-pop.)
      if (window.history.state?.__modalTrap) {
        window.history.back();
      }
    };
  }, [open]);
}
