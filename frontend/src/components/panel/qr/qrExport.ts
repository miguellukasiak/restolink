import montserratLatin from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import montserratLatinExt from '@fontsource/montserrat/files/montserrat-latin-ext-700-normal.woff2?url';
import playfairLatin from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import playfairLatinExt from '@fontsource/playfair-display/files/playfair-display-latin-ext-700-normal.woff2?url';
import robotoLatin from '@fontsource/roboto/files/roboto-latin-700-normal.woff2?url';
import robotoLatinExt from '@fontsource/roboto/files/roboto-latin-ext-700-normal.woff2?url';
import loraLatin from '@fontsource/lora/files/lora-latin-700-normal.woff2?url';
import loraLatinExt from '@fontsource/lora/files/lora-latin-ext-700-normal.woff2?url';
import nunitoLatin from '@fontsource/nunito/files/nunito-latin-800-normal.woff2?url';
import nunitoLatinExt from '@fontsource/nunito/files/nunito-latin-ext-800-normal.woff2?url';
import josefinLatin from '@fontsource/josefin-sans/files/josefin-sans-latin-700-normal.woff2?url';
import josefinLatinExt from '@fontsource/josefin-sans/files/josefin-sans-latin-ext-700-normal.woff2?url';
import oswaldLatin from '@fontsource/oswald/files/oswald-latin-600-normal.woff2?url';
import oswaldLatinExt from '@fontsource/oswald/files/oswald-latin-ext-600-normal.woff2?url';
import dmSerifLatin from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url';
import dmSerifLatinExt from '@fontsource/dm-serif-display/files/dm-serif-display-latin-ext-400-normal.woff2?url';
import pacificoLatin from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url';
import pacificoLatinExt from '@fontsource/pacifico/files/pacifico-latin-ext-400-normal.woff2?url';
import caveatLatin from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import caveatLatinExt from '@fontsource/caveat/files/caveat-latin-ext-700-normal.woff2?url';
import type { SheetPlan } from './qrTemplates';
import { escapeXml } from './qrArt';
import { tp } from '../../../i18n/panel';

/*
 * Getting the design out of the browser: PNG, SVG, a print sheet, and the
 * scan test that decodes the rendered result.
 *
 * An SVG drawn onto a canvas (for PNG) or saved as a file cannot reach the
 * page's web fonts, so text would fall back to whatever the machine has.
 * The fonts the templates use are bundled with the app (@fontsource), so they
 * are fetched from our own origin and inlined as data URIs — the file renders
 * the same everywhere, Polish letters included.
 */

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/** The one weight of each face the templates set, as [latin, latin-ext].
 *  Montserrat is the call to action; the rest are menu heading faces used
 *  for the restaurant's name. Georgia is a system font and is not bundled. */
const FONT_FILES: Record<string, { weight: number; files: [string, string] }> = {
  Montserrat: { weight: 700, files: [montserratLatin, montserratLatinExt] },
  'Playfair Display': { weight: 700, files: [playfairLatin, playfairLatinExt] },
  Roboto: { weight: 700, files: [robotoLatin, robotoLatinExt] },
  Lora: { weight: 700, files: [loraLatin, loraLatinExt] },
  Nunito: { weight: 800, files: [nunitoLatin, nunitoLatinExt] },
  'Josefin Sans': { weight: 700, files: [josefinLatin, josefinLatinExt] },
  Oswald: { weight: 600, files: [oswaldLatin, oswaldLatinExt] },
  'DM Serif Display': { weight: 400, files: [dmSerifLatin, dmSerifLatinExt] },
  Pacifico: { weight: 400, files: [pacificoLatin, pacificoLatinExt] },
  Caveat: { weight: 700, files: [caveatLatin, caveatLatinExt] },
};

const dataUriCache = new Map<string, Promise<string>>();

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Any fetchable URL as a data URI (cached). Rejects when it cannot be read. */
export function toDataUri(url: string): Promise<string> {
  if (url.startsWith('data:')) return Promise.resolve(url);
  let pending = dataUriCache.get(url);
  if (!pending) {
    pending = fetch(url, { mode: 'cors' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blobToDataUri);
    pending.catch(() => dataUriCache.delete(url));
    dataUriCache.set(url, pending);
  }
  return pending;
}

/**
 * `@font-face` rules with the fonts inlined, for the given families.
 * A font that cannot be fetched is left out: the text falls back, the
 * export still happens.
 */
export async function embeddedFontCss(families: string[]): Promise<string> {
  const rules = await Promise.all(
    [...new Set(families)].flatMap((family) => {
      const font = FONT_FILES[family];
      if (!font) return [];
      return font.files.map((url, index) =>
        toDataUri(url)
          .then(
            (uri) =>
              `@font-face{font-family:'${family}';font-weight:${font.weight};font-style:normal;` +
              `src:url(${uri}) format('woff2');unicode-range:${index === 0 ? LATIN : LATIN_EXT}}`,
          )
          .catch(() => ''),
      );
    }),
  );
  return rules.join('');
}

/** Draws an SVG document onto a canvas of the given pixel size. */
export async function rasterize(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(tp('qr.errors.draw')));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error(tp('qr.errors.canvas'));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Millimetres to pixels at print resolution (300 dpi). */
export const mmToPrintPx = (mm: number) => Math.round((mm / 25.4) * 300);

export async function downloadPng(
  svg: string,
  widthMm: number,
  heightMm: number,
  name: string,
) {
  // Never smaller than 2000px on the long side, so a 5 cm code still makes a
  // crisp poster or social-media image when someone scales it up.
  const scale = Math.max(1, 2000 / Math.max(mmToPrintPx(widthMm), mmToPrintPx(heightMm)));
  const canvas = await rasterize(
    svg,
    mmToPrintPx(widthMm) * scale,
    mmToPrintPx(heightMm) * scale,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error(tp('qr.errors.save'));
  saveBlob(blob, `${name}.png`);
}

export function downloadSvg(svg: string, name: string) {
  saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`);
}

/**
 * Prints a sheet through the browser's own dialog, where "Save as PDF"
 * gives a vector PDF with the fonts embedded — the file a print shop wants.
 *
 * A hidden iframe rather than a new window: no pop-up blocker in the way,
 * and nothing left open afterwards.
 */
export async function printSheet(sheetSvg: string, plan: SheetPlan) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  if (!doc || !view) {
    frame.remove();
    throw new Error(tp('qr.errors.print'));
  }
  const [w, h] = [`${plan.width}mm`, `${plan.height}mm`];
  // `body>svg`, not `svg`: the codes are nested <svg> elements too, and a
  // page-sized rule on them blew each one up to the size of the sheet.
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>RestoLink – ${escapeXml(tp('qr.printTitle'))}</title>` +
      `<style>@page{size:${plan.page} ${plan.orientation};margin:0}html,body{margin:0;padding:0}` +
      `body>svg{display:block;width:${w};height:${h}}</style></head><body>${sheetSvg}</body></html>`,
  );
  doc.close();
  await doc.fonts?.ready;
  // Images inside the SVG (a logo) decode after the fonts; give them a beat.
  await new Promise((resolve) => setTimeout(resolve, 300));
  view.focus();
  view.print();
  // `print()` blocks in most browsers; the delay covers the ones where it
  // returns at once and the dialog still needs the document.
  setTimeout(() => frame.remove(), 60_000);
}

/**
 * Decodes the rendered design the way a phone would — from pixels — and says
 * whether it came back as `expected`. jsQR is loaded on demand: it is only
 * needed on this page.
 */
export async function decodesTo(
  svg: string,
  width: number,
  height: number,
  expected: string,
): Promise<boolean> {
  const [{ default: jsQR }, canvas] = await Promise.all([
    import('jsqr'),
    rasterize(svg, width, height),
  ]);
  const context = canvas.getContext('2d');
  if (!context) return false;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(pixels.data, pixels.width, pixels.height, {
    inversionAttempts: 'dontInvert',
  });
  return result?.data === expected;
}
