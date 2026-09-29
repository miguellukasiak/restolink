/*
 * Decorative backgrounds for the public menu, stored by name in
 * `restaurant.menu_pattern`.
 *
 * Each is a small SVG tile, repeated, drawn in the menu's own primary colour
 * at a low opacity. They sit behind the category headings only: whenever a
 * pattern is on, the dish cards get a solid surface (see
 * createRestaurantTheme's `menuDecor.cards`), so no dish name or price is
 * ever read off a busy background.
 */

export interface MenuPattern {
  id: string;
  label: string;
  /** Tile width and height, in CSS pixels. */
  size: [number, number];
  /** Opacity on a light background; dark backgrounds get a little more. */
  opacity: number;
  /** SVG body for one tile, drawn in `c`. */
  draw: (c: string) => string;
}

const leaf = (x: number, y: number, rotate: number, scale: number, c: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})">` +
  `<path d="M0 0C6-9 20-11 30 0C20 11 6 9 0 0Z" fill="${c}"/>` +
  `<path d="M2 0H27" stroke="${c}" stroke-width="0.8" opacity="0.6"/></g>`;

/** One palm frond: a curved rib with leaflets fanning off both sides. */
const frond = (x: number, y: number, rotate: number, c: string) => {
  let leaflets = '';
  for (let i = 0; i < 7; i += 1) {
    const t = 6 + i * 7;
    const size = 1 - i * 0.09;
    leaflets +=
      `<path d="M${t} 0 q ${6 * size} ${-14 * size} ${16 * size} ${-17 * size} ` +
      `q ${-7 * size} ${8 * size} ${-14 * size} ${17 * size}Z" fill="${c}"/>` +
      `<path d="M${t} 0 q ${6 * size} ${14 * size} ${16 * size} ${17 * size} ` +
      `q ${-7 * size} ${-8 * size} ${-14 * size} ${-17 * size}Z" fill="${c}"/>`;
  }
  return (
    `<g transform="translate(${x} ${y}) rotate(${rotate})">` +
    `<path d="M0 0Q28 -4 56 2" stroke="${c}" stroke-width="1.6" fill="none"/>${leaflets}</g>`
  );
};

export const MENU_PATTERNS: readonly MenuPattern[] = [
  {
    id: 'dots',
    label: 'Groszki',
    size: [26, 26],
    opacity: 0.12,
    draw: (c) =>
      `<circle cx="6.5" cy="6.5" r="2.2" fill="${c}"/><circle cx="19.5" cy="19.5" r="2.2" fill="${c}"/>`,
  },
  {
    id: 'grid',
    label: 'Kratka',
    size: [28, 28],
    opacity: 0.1,
    draw: (c) =>
      `<path d="M28 .5H0M.5 0V28" stroke="${c}" stroke-width="1" fill="none"/>`,
  },
  {
    id: 'gingham',
    label: 'Obrus',
    size: [32, 32],
    opacity: 0.08,
    draw: (c) =>
      `<rect width="16" height="32" fill="${c}"/><rect width="32" height="16" fill="${c}"/>`,
  },
  {
    id: 'stripes',
    label: 'Paski',
    size: [36, 36],
    opacity: 0.08,
    draw: (c) =>
      `<path d="M-9 9L9-9M0 36L36 0M27 45L45 27" stroke="${c}" stroke-width="9"/>`,
  },
  {
    id: 'waves',
    label: 'Fale',
    size: [48, 24],
    opacity: 0.14,
    draw: (c) =>
      `<path d="M0 12Q12 3 24 12T48 12" stroke="${c}" stroke-width="1.6" fill="none"/>`,
  },
  {
    id: 'seigaiha',
    label: 'Seigaiha',
    size: [40, 20],
    opacity: 0.12,
    draw: (c) => {
      const arcs = (cx: number, cy: number) =>
        [19, 14, 9, 4]
          .map(
            (r) =>
              `<path d="M${cx - r} ${cy}a${r} ${r} 0 0 1 ${2 * r} 0" stroke="${c}" stroke-width="1.2" fill="none"/>`,
          )
          .join('');
      return arcs(0, 10) + arcs(40, 10) + arcs(20, 20) + arcs(20, 0);
    },
  },
  {
    id: 'palms',
    label: 'Palmy',
    size: [150, 150],
    opacity: 0.11,
    draw: (c) =>
      frond(8, 40, -28, c) +
      frond(92, 112, 150, c) +
      frond(98, 20, 32, c) +
      frond(20, 130, -62, c),
  },
  {
    id: 'leaves',
    label: 'Liście',
    size: [90, 90],
    opacity: 0.12,
    draw: (c) =>
      leaf(10, 20, -30, 0.9, c) +
      leaf(55, 12, 20, 0.7, c) +
      leaf(40, 60, -70, 0.8, c) +
      leaf(70, 72, 35, 0.6, c),
  },
  {
    id: 'terrazzo',
    label: 'Posypka',
    size: [80, 80],
    opacity: 0.16,
    draw: (c) =>
      [
        [10, 12, 20],
        [42, 8, -35],
        [66, 26, 70],
        [22, 44, -60],
        [52, 50, 15],
        [12, 70, 45],
        [70, 66, -20],
        [38, 30, 100],
      ]
        .map(
          ([x, y, r]) =>
            `<rect x="${x}" y="${y}" width="9" height="3" rx="1.5" fill="${c}" transform="rotate(${r} ${x + 4.5} ${y + 1.5})"/>`,
        )
        .join(''),
  },
  {
    id: 'wood',
    label: 'Drewno',
    size: [200, 48],
    opacity: 0.1,
    draw: (c) =>
      [6, 17, 29, 40]
        .map(
          (y, i) =>
            `<path d="M0 ${y}C40 ${y - 3 + i} 70 ${y + 4} 110 ${y}S170 ${y - 3} 200 ${y}" stroke="${c}" stroke-width="${i % 2 ? 0.8 : 1.4}" fill="none"/>`,
        )
        .join(''),
  },
];

export function getMenuPattern(id?: string | null): MenuPattern | null {
  return MENU_PATTERNS.find((pattern) => pattern.id === id) ?? null;
}

/**
 * CSS for a pattern in a colour, as `background-image` and `background-size`
 * values — or null for a plain background.
 */
export function patternCss(
  id: string | null | undefined,
  color: string,
  darkBackground: boolean,
): { backgroundImage: string; backgroundSize: string } | null {
  const pattern = getMenuPattern(id);
  if (!pattern) return null;
  const [w, h] = pattern.size;
  const opacity = darkBackground ? pattern.opacity * 1.5 : pattern.opacity;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<g opacity="${opacity.toFixed(3)}">${pattern.draw(color)}</g></svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${w}px ${h}px`,
  };
}
