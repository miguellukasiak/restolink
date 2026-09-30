import { describe, expect, it } from 'vitest';
import { edgeColors } from './photoFill';

type Rgba = [number, number, number, number];

/** A width × height RGBA image painted by `paint(x, y)`. */
function image(width: number, height: number, paint: (x: number, y: number) => Rgba) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4);
  }
  return data;
}

const WHITE: Rgba = [255, 255, 255, 255];
const WINE: Rgba = [90, 10, 20, 255];

describe('the edge colours', () => {
  it('finds the plain backdrop around a tall bottle', () => {
    // A dark bottle down the middle of a white 40×100 shot.
    const data = image(40, 100, (x) => (x > 12 && x < 28 ? WINE : WHITE));
    const { colors, uniform } = edgeColors(data, 40, 100);
    expect(colors[0]).toBe('#ffffff');
    expect(uniform).toBe(true);
  });

  it('reads a tall photo at its sides and a wide one at its top and bottom', () => {
    // Red down the sides, blue along the top and bottom.
    const paint =
      (width: number, height: number) =>
      (x: number, y: number): Rgba =>
        x < 3 || x >= width - 3
          ? [200, 0, 0, 255]
          : y < 3 || y >= height - 3
            ? [0, 0, 200, 255]
            : WHITE;
    expect(edgeColors(image(40, 100, paint(40, 100)), 40, 100).colors[0]).toBe('#c80000');
    expect(edgeColors(image(100, 40, paint(100, 40)), 100, 40).colors[0]).toBe('#0000c8');
  });

  it('calls busy edges not uniform, and offers a few distinct colours', () => {
    // A table: stripes of wood tones and plates along every edge.
    const tones: Rgba[] = [
      [120, 70, 30, 255],
      [200, 160, 110, 255],
      [240, 240, 235, 255],
      [60, 40, 20, 255],
    ];
    const data = image(60, 90, (x, y) => tones[(x + y) % tones.length]);
    const { colors, uniform } = edgeColors(data, 60, 90);
    expect(uniform).toBe(false);
    expect(colors.length).toBe(3);
  });

  it('puts a cut-out on white', () => {
    const data = image(30, 60, (x) => (x > 10 && x < 20 ? WINE : [0, 0, 0, 0]));
    expect(edgeColors(data, 30, 60)).toEqual({ colors: ['#ffffff'], uniform: true });
  });
});
