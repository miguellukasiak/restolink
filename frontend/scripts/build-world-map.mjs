// Builds src/components/panel/languages/worldCountries.json — the map on the
// "Języki" screen — from Natural Earth's 1:110m countries.
//
//   node scripts/build-world-map.mjs
//
// Natural Earth is public domain (naturalearthdata.com/about/terms-of-use), so
// the output carries no licence obligations. The release is pinned: a later one
// can move borders or populations, and the reach figures should only change
// when someone decides they should.
//
// Paths are projected here, once, rather than in the browser: the page then
// ships plain SVG path strings and no projection code at all.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoEqualEarth, geoPath } from 'd3-geo';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson';
const WIDTH = 1000;
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/components/panel/languages/worldCountries.json',
);

/** Europe with its neighbours: where most guests of a Polish restaurant come from. */
const EUROPE = { west: -12, east: 44, south: 29, north: 71 };

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
const collection = await response.json();

// Antarctica and the French Southern Lands: nobody lives there, and the map
// reads better without a white band along the bottom.
const features = collection.features.filter(
  (feature) => feature.properties.POP_EST > 1000 && feature.properties.ADM0_A3 !== 'ATA',
);

const projection = geoEqualEarth().fitWidth(WIDTH, {
  type: 'FeatureCollection',
  features,
});
const toPath = geoPath(projection).digits(1);
const measure = geoPath(projection);

const [[, top], [, bottom]] = measure.bounds({ type: 'FeatureCollection', features });

// The box's edges, projected point by point. (A GeoJSON polygon would do, but
// d3 reads a ring's winding as which side is inside, and the wrong winding
// quietly yields the whole world minus Europe.)
const edge = [];
for (let lon = EUROPE.west; lon <= EUROPE.east; lon += 1) {
  edge.push([lon, EUROPE.south], [lon, EUROPE.north]);
}
for (let lat = EUROPE.south; lat <= EUROPE.north; lat += 1) {
  edge.push([EUROPE.west, lat], [EUROPE.east, lat]);
}
const projected = edge.map((point) => projection(point));
const europeBox = [
  [Math.min(...projected.map(([x]) => x)), Math.min(...projected.map(([, y]) => y))],
  [Math.max(...projected.map(([x]) => x)), Math.max(...projected.map(([, y]) => y))],
];

const round = (value) => Math.round(value * 10) / 10;

const countries = features
  .map((feature) => {
    const p = feature.properties;
    // Natural Earth writes -99 where ISO has no code (Somaliland, Northern
    // Cyprus); its own three-letter code is unique there.
    const key = p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ADM0_A3;
    const [cx, cy] = measure.centroid(feature);
    return {
      key,
      name: p.NAME_PL,
      pop: p.POP_EST,
      d: toPath(feature),
      c: [round(cx), round(cy)],
    };
  })
  .sort((a, b) => a.key.localeCompare(b.key));

const output = {
  source: 'Natural Earth 1:110m Admin 0 – Countries, v5.1.2 (public domain)',
  views: {
    world: [0, round(top), WIDTH, round(bottom - top)],
    europe: [
      round(europeBox[0][0]),
      round(europeBox[0][1]),
      round(europeBox[1][0] - europeBox[0][0]),
      round(europeBox[1][1] - europeBox[0][1]),
    ],
  },
  countries,
};

writeFileSync(OUT, JSON.stringify(output));
console.log(`${countries.length} countries → ${OUT}`);
