/**
 * Links to a restaurant's public menu, and the compact form printed in QR codes.
 *
 * A QR code grows with its content, and every extra module shrinks the rest
 * at a given print size. The full link — `https://<host>/menu/<uuid>` — is
 * mostly UUID, so the printed code carries a shorter one instead:
 *
 * - the UUID as 25 base-36 characters (the same 128 bits, 11 fewer characters)
 *   under `/m/`, which `ShortMenuLink` expands back into `/menu/<uuid>`;
 * - upper-cased after the scheme, so everything but `https://` fits QR's
 *   *alphanumeric* mode (5.5 bits a character instead of 8). Host names are
 *   case-insensitive and browsers lower-case them; the scheme stays lower-case
 *   in its own byte-mode segment so every scanner still sees an ordinary link.
 *
 * At error correction H (with a logo) that takes the code from 49×49 modules
 * to 41×41; at Q (without one), from 45×45 to 33×33.
 */

/** Characters QR's alphanumeric mode can encode. */
const ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]*$/;

/** Base-36 digits needed for any 128-bit value. */
const CODE_LENGTH = 25;

/** One run of a QR payload and the mode it is encoded in. */
export interface QrSegment {
  data: string;
  mode: 'Byte' | 'Alphanumeric';
}

/** A restaurant id as its 25-character base-36 menu code. */
export function shortMenuCode(restaurantId: string): string {
  const hex = restaurantId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error(`Not a restaurant id: ${restaurantId}`);
  }
  return BigInt(`0x${hex}`).toString(36).padStart(CODE_LENGTH, '0');
}

/** The restaurant id a menu code stands for, or null if it is not one. */
export function restaurantIdFromShortCode(code: string): string | null {
  const normalized = code.trim().toLowerCase();
  if (!/^[0-9a-z]{1,25}$/.test(normalized)) return null;
  let value = 0n;
  for (const digit of normalized) {
    value = value * 36n + BigInt(parseInt(digit, 36));
  }
  if (value >= 1n << 128n) return null;
  const hex = value.toString(16).padStart(32, '0');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/** The short link, written the way a person would type or share it. */
export function shortMenuUrl(origin: string, restaurantId: string): string {
  return `${origin}/m/${shortMenuCode(restaurantId)}`;
}

/**
 * What the QR code encodes: the short link split into a byte-mode scheme and
 * an alphanumeric remainder. `text` is the whole payload as a scanner reads it.
 */
export function qrMenuPayload(
  origin: string,
  restaurantId: string,
): { segments: QrSegment[]; text: string } {
  const url = new URL(origin);
  const scheme = `${url.protocol}//`;
  const rest = `${url.host}/M/${shortMenuCode(restaurantId)}`.toUpperCase();
  if (!ALPHANUMERIC.test(rest)) {
    // A host outside the alphanumeric alphabet (an IDN, say) is still a valid
    // link — it just cannot be compressed.
    const link = shortMenuUrl(origin, restaurantId);
    return { segments: [{ data: link, mode: 'Byte' }], text: link };
  }
  return {
    segments: [
      { data: scheme, mode: 'Byte' },
      { data: rest, mode: 'Alphanumeric' },
    ],
    text: scheme + rest,
  };
}
