import type { Area } from 'react-easy-crop';

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

/** Loads an image and resolves once it's ready to be drawn to a canvas. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Nie udało się wczytać zdjęcia.')));
    image.crossOrigin = 'anonymous';
    image.src = src;
  });
}

/**
 * Crops `imageSrc` to the pixel rectangle `pixelCrop` (as reported by
 * react-easy-crop's `onCropComplete`) and rasterizes it into a fixed
 * `OUTPUT_SIZE`x`OUTPUT_SIZE` square, regardless of the source resolution or
 * the crop rectangle's own size — every dish photo ends up identically sized
 * and compressed, so even a 5 MB phone photo uploads as a tiny JPEG.
 */
export async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Przeglądarka nie obsługuje przetwarzania obrazów.');

  // High-quality downscale — the source region is almost always far larger than
  // 600px, so good resampling keeps the shrunk photo crisp.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nie udało się przetworzyć zdjęcia.'))),
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
    reader.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia.'));
    reader.readAsDataURL(blob);
  });
}
