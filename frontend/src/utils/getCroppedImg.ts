import type { Area } from 'react-easy-crop';
import { renderSquare, type PhotoFill } from './photoFill';

/**
 * Fixed output dimensions — every cropped dish photo is a uniform square, hard
 * capped at 600×600 px. That's ample for a retina mobile card yet shrinks a
 * multi-megapixel phone photo down to a ~40–80 KB upload, which is the whole
 * point on slow mobile networks / low-RAM devices.
 */
const OUTPUT_SIZE = 600;

/** JPEG quality for the exported crop — 0.8 is visually lossless at this size. */
const OUTPUT_QUALITY = 0.8;

/** Output MIME type. JPEG keeps payloads tiny and decodes everywhere (old phones). */
const OUTPUT_MIME = 'image/jpeg';

/**
 * Rasterizes the part of `imageSrc` the cropper framed (`pixelCrop`, as
 * react-easy-crop reports it) into a fixed `OUTPUT_SIZE` square, regardless
 * of the source resolution — every dish photo ends up identically sized and
 * compressed, so even a 5 MB phone photo uploads as a tiny JPEG.
 *
 * The frame may reach past the photo when the owner shrank it to fit whole;
 * `fill` paints what the photo leaves uncovered (utils/photoFill.ts).
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  fill: PhotoFill = { kind: 'color', color: '#ffffff' },
  blurred?: string,
): Promise<Blob> {
  const canvas = await renderSquare(imageSrc, pixelCrop, fill, OUTPUT_SIZE, blurred);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not process the image.')),
      OUTPUT_MIME,
      OUTPUT_QUALITY,
    );
  });
}

/** Reads a Blob into a base64 Data URI (the format this app stores images as). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}
