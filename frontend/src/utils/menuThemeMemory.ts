import type { RestaurantThemeUpdate } from '../types';

/**
 * Remembers a restaurant's visual theme between visits.
 *
 * The public menu's colours live in the payload the page is still waiting for,
 * so the very first paint has nothing to go on and falls back to the light
 * default. On a dark-themed restaurant that is a white flash followed by a dark
 * menu; on a light one it is fine. Either way the skeleton cannot match a theme
 * it has not been told about yet.
 *
 * Caching the last-known theme fixes that for every visit after the first: the
 * skeleton, and the page behind it, paint in the restaurant's own colours
 * immediately. A guest at a table who reloads, or returns after their session
 * cache expired, never sees the wrong ground colour.
 *
 * Only presentation is stored, and only per restaurant. A stale entry is
 * harmless — it is replaced the moment the real payload lands.
 */

const KEY_PREFIX = 'restolink:theme:';

/** The fields worth remembering: everything the theme is built from. */
type RememberedTheme = Pick<
  RestaurantThemeUpdate,
  'primary_color' | 'background_color' | 'font_family'
>;

function key(restaurantId: string): string {
  return `${KEY_PREFIX}${restaurantId}`;
}

export function recallMenuTheme(restaurantId: string): RememberedTheme | undefined {
  if (!restaurantId) return undefined;
  try {
    const raw = localStorage.getItem(key(restaurantId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as RememberedTheme;
    // A malformed entry must not be able to produce an unreadable theme, so
    // anything without a usable background is treated as absent.
    return typeof parsed?.background_color === 'string' ? parsed : undefined;
  } catch {
    // Private mode, cleared storage, corrupt JSON — fall back to the default
    // theme rather than failing the page.
    return undefined;
  }
}

export function rememberMenuTheme(
  restaurantId: string,
  theme: RestaurantThemeUpdate | undefined,
): void {
  if (!restaurantId || !theme?.background_color) return;
  try {
    localStorage.setItem(
      key(restaurantId),
      JSON.stringify({
        primary_color: theme.primary_color,
        background_color: theme.background_color,
        font_family: theme.font_family,
      } satisfies RememberedTheme),
    );
  } catch {
    // Storage unavailable or full. The next visit simply starts from the
    // default again, which is exactly today's behaviour.
  }
}
