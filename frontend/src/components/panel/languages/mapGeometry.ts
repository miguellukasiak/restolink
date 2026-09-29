import worldMap from './worldCountries.json';

/*
 * Geometry and colours shared by the language map and the panel around it.
 */

export type MapView = 'world' | 'europe';

/** Fill per coverage step: nobody, some, most, nearly everyone. */
export const STEP_FILLS = ['#D8DFDB', '#BEE3CF', '#5DBE8E', '#0F8256'] as const;

/** Countries a hovered language would add to. Warm, so it reads as "not yet". */
export const PREVIEW_FILL = '#F2B84B';

export const [, , WORLD_W, WORLD_H] = worldMap.views.world;

/**
 * The transform that frames a view inside the world's viewBox. The map keeps
 * one viewBox and moves a group inside it, so switching views can animate
 * (a viewBox change cannot) and the SVG keeps its size on the page.
 */
export function frame(view: MapView): string {
  if (view === 'world') return 'translate(0px, 0px) scale(1)';
  const [x, y, w, h] = worldMap.views.europe;
  const scale = Math.min(WORLD_W / w, WORLD_H / h);
  // Centre the box: the spare width or height is shared on both sides.
  const offsetX = (WORLD_W / scale - w) / 2;
  const offsetY = (WORLD_H / scale - h) / 2;
  return `scale(${scale}) translate(${offsetX - x}px, ${offsetY - y}px)`;
}

export function viewScale(view: MapView): number {
  if (view === 'world') return 1;
  const [, , w, h] = worldMap.views.europe;
  return Math.min(WORLD_W / w, WORLD_H / h);
}

/** Where a country's centre falls on the rendered map, as fractions of its box. */
export function countryAnchor(
  key: string,
  view: MapView,
): { x: number; y: number } | null {
  const country = worldMap.countries.find((entry) => entry.key === key);
  if (!country) return null;
  const [cx, cy] = country.c;
  if (view === 'world') return { x: cx / WORLD_W, y: cy / WORLD_H };
  const [x, y, w, h] = worldMap.views.europe;
  const scale = viewScale('europe');
  const offsetX = (WORLD_W / scale - w) / 2;
  const offsetY = (WORLD_H / scale - h) / 2;
  return {
    x: ((cx - x + offsetX) * scale) / WORLD_W,
    y: ((cy - y + offsetY) * scale) / WORLD_H,
  };
}
