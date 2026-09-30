/*
 * The background behind a dish photo that is not square.
 *
 * Every dish photo is stored as a square, so the guest menu's grid stays
 * even. A tall bottle or a wide platter used to lose its top and bottom (or
 * its sides) to the crop; now the owner can shrink it into the square, and
 * the space around it is filled:
 *
 *   - with the colour of the photo's own edges — the ones that meet the
 *     background (left and right of a tall photo) — which disappears into a
 *     product shot on a plain backdrop;
 *   - or with the same photo, enlarged and heavily blurred, which suits a
 *     photo whose edges are busy (a table, a room), where a flat colour
 *     would read as a pasted-on strip.
 *
 * "Auto" picks between them from how uniform those edges are.
 */

import { hexToRgb } from './colors';

/** A fill the square is painted with before the photo goes on top. */
export type PhotoFill = { kind: 'color'; color: string } | { kind: 'blur' };

export interface PhotoAnalysis {
  width: number;
  height: number;
  /** Up to three distinct colours from the edges, most common first. */
  edgeColors: string[];
  /** True when most of those edges are one colour — a plain backdrop. */
  uniform: boolean;
  /** The photo covering a square, blurred: a data URI for preview and output. */
  blurred: string;
}

type Rgb = [number, number, number];

const toHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** How far apart two edge colours must be to both be offered. */
const DISTINCT = 48;
/** How close a pixel must be to the main colour to count as "the same". */
const SAME = 36;
/** Share of edge pixels that makes the edges a plain backdrop. */
const UNIFORM_SHARE = 0.6;

/**
 * The colours of the edges that will meet the background, from pixels read
 * off a small copy of the photo. `data` is RGBA, `width` × `height`. Pixels
 * more transparent than opaque count as white — a cut-out PNG sits on white.
 */
export function edgeColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { colors: string[]; uniform: boolean } {
  const pixels: Rgb[] = [];
  const read = (x: number, y: number) => {
    const at = (y * width + x) * 4;
    pixels.push(
      data[at + 3] < 128 ? [255, 255, 255] : [data[at], data[at + 1], data[at + 2]],
    );
  };
  const tall = height > width * 1.02;
  const wide = width > height * 1.02;
  const thickX = Math.max(2, Math.round(width * 0.04));
  const thickY = Math.max(2, Math.round(height * 0.04));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const leftOrRight = x < thickX || x >= width - thickX;
      const topOrBottom = y < thickY || y >= height - thickY;
      // A tall photo meets the background at its sides, a wide one at its
      // top and bottom, a square one all round.
      if (tall ? leftOrRight : wide ? topOrBottom : leftOrRight || topOrBottom) {
        read(x, y);
      }
    }
  }
  if (pixels.length === 0) return { colors: ['#ffffff'], uniform: true };

  // Group into 16 levels per channel, then average each group's real pixels.
  const groups = new Map<number, { sum: Rgb; count: number }>();
  for (const [r, g, b] of pixels) {
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const group = groups.get(key) ?? { sum: [0, 0, 0], count: 0 };
    group.sum[0] += r;
    group.sum[1] += g;
    group.sum[2] += b;
    group.count += 1;
    groups.set(key, group);
  }
  const ranked = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ sum, count }) => [sum[0] / count, sum[1] / count, sum[2] / count] as Rgb);

  const chosen: Rgb[] = [];
  for (const color of ranked) {
    if (chosen.every((other) => distance(color, other) > DISTINCT)) chosen.push(color);
    if (chosen.length === 3) break;
  }
  const main = chosen[0];
  const same = pixels.filter((pixel) => distance(pixel, main) <= SAME).length;
  return { colors: chosen.map(toHex), uniform: same / pixels.length >= UNIFORM_SHARE };
}

/** Loads an image and resolves once it can be drawn to a canvas. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Could not load the image.')));
    image.crossOrigin = 'anonymous';
    image.src = src;
  });
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('This browser cannot process images.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return { element, context };
}

/** Draws `image` so it covers a `size` square, centred. */
function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  size: number,
) {
  const scale = size / Math.min(image.width, image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
}

/**
 * The photo blurred over a `size` square. Blurred by shrinking and growing
 * again in steps rather than `ctx.filter`, which Safari's canvas lacks — so
 * every browser gets the same soft result.
 */
function blurredSquare(image: HTMLImageElement, size: number): HTMLCanvasElement {
  let current: HTMLCanvasElement | HTMLImageElement = image;
  for (const step of [12, 48, size]) {
    const next = canvas(step, step);
    if (current === image) drawCover(next.context, image, step);
    else next.context.drawImage(current, 0, 0, step, step);
    current = next.element;
  }
  return current as HTMLCanvasElement;
}

/** Reads what the background needs from a photo, once, when it is picked. */
export async function analyzePhoto(src: string): Promise<PhotoAnalysis> {
  const image = await loadImage(src);
  const scale = 96 / Math.max(image.width, image.height);
  const small = canvas(
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  );
  small.context.drawImage(image, 0, 0, small.element.width, small.element.height);
  const { data } = small.context.getImageData(
    0,
    0,
    small.element.width,
    small.element.height,
  );
  const { colors, uniform } = edgeColors(data, small.element.width, small.element.height);
  return {
    width: image.width,
    height: image.height,
    edgeColors: colors,
    uniform,
    blurred: blurredSquare(image, 300).toDataURL('image/jpeg', 0.8),
  };
}

/** What "Auto" means for this photo. */
export function autoFill(analysis: PhotoAnalysis): PhotoFill {
  return analysis.uniform
    ? { kind: 'color', color: analysis.edgeColors[0] }
    : { kind: 'blur' };
}

/** The part of the source photo that lands in the square, in its pixels. */
export interface SourceArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far a photo's edge fades into a flat background, in output pixels. */
const FEATHER = 8;

/**
 * Paints the finished square: the fill, then the photo where the cropper put
 * it. `area` may reach past the photo (negative x, or wider than it) — that
 * is the shrunk photo with space around it; inside the photo it is an
 * ordinary crop and the fill never shows. Against a flat colour the photo's
 * edges fade into it over a few pixels, so no hard seam shows where a
 * backdrop that is almost, not exactly, that colour meets it.
 */
export async function renderSquare(
  src: string,
  area: SourceArea,
  fill: PhotoFill,
  size: number,
  blurred?: string,
): Promise<HTMLCanvasElement> {
  const image = await loadImage(src);
  const { element, context } = canvas(size, size);

  if (fill.kind === 'blur') {
    const soft = blurred ? await loadImage(blurred) : blurredSquare(image, size);
    context.drawImage(soft, 0, 0, size, size);
  } else {
    context.fillStyle = fill.color;
    context.fillRect(0, 0, size, size);
  }

  const scale = size / area.width;
  const x = -area.x * scale;
  const y = -area.y * scale;
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, x, y, width, height);

  if (fill.kind === 'color') {
    const top = Math.max(0, y);
    const bottom = Math.min(size, y + height);
    const left = Math.max(0, x);
    const right = Math.min(size, x + width);
    // Fades to the same colour at zero opacity: fading to "transparent"
    // (transparent black) would leave a dark fringe.
    const [r, g, b] = hexToRgb(fill.color) ?? [255, 255, 255];
    const fade = (x0: number, y0: number, x1: number, y1: number) => {
      const gradient = context.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      return gradient;
    };
    // Only the edges that sit inside the square meet the fill.
    if (x > 0.5) {
      context.fillStyle = fade(x, 0, x + FEATHER, 0);
      context.fillRect(x, top, FEATHER, bottom - top);
    }
    if (x + width < size - 0.5) {
      context.fillStyle = fade(x + width, 0, x + width - FEATHER, 0);
      context.fillRect(x + width - FEATHER, top, FEATHER, bottom - top);
    }
    if (y > 0.5) {
      context.fillStyle = fade(0, y, 0, y + FEATHER);
      context.fillRect(left, y, right - left, FEATHER);
    }
    if (y + height < size - 0.5) {
      context.fillStyle = fade(0, y + height, 0, y + height - FEATHER);
      context.fillRect(left, y + height - FEATHER, right - left, FEATHER);
    }
  }
  return element;
}
