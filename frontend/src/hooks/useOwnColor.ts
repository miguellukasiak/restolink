import { useState } from 'react';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The colour of the owner's own making, kept as a swatch beside the rainbow
 * circle. The current value shows there whenever it is none of the ready
 * ones (a theme's colour, say), but only a colour the owner picked — from
 * the rainbow, the hex field or the eyedropper — is remembered once a ready
 * colour is tried, so it is one tap away. Remembering every value would
 * have kept the form's placeholder from before the saved theme loaded.
 *
 * Returns the swatch's colour (null for none) and `remember`, for the
 * row's own pickers to call with what was picked.
 */
export function useOwnColor(value: string, isReady: (value: string) => boolean) {
  const [picked, setPicked] = useState<string | null>(null);
  const current = HEX.test(value) && !isReady(value) ? value.toUpperCase() : null;
  const remember = (color: string) => {
    if (HEX.test(color) && !isReady(color)) setPicked(color.toUpperCase());
  };
  return [current ?? picked, remember] as const;
}
