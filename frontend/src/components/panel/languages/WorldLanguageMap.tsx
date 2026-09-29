import { memo, useMemo } from 'react';
import Box from '@mui/material/Box';
import worldMap from './worldCountries.json';
import { coverage, coverageStep } from './reach';
import {
  PREVIEW_FILL,
  STEP_FILLS,
  WORLD_H,
  WORLD_W,
  frame,
  viewScale,
  type MapView,
} from './mapGeometry';

interface WorldLanguageMapProps {
  /** Languages the menu is read in now, its own included. */
  languages: readonly string[];
  /** A language being considered: the countries it would add light up. */
  preview: string | null;
  hovered: string | null;
  view: MapView;
  /** The country the restaurant is in, marked with a pin. */
  home: string;
  onHover: (key: string | null) => void;
  onPick: (key: string) => void;
}

function WorldLanguageMapComponent({
  languages,
  preview,
  hovered,
  view,
  home,
  onHover,
  onPick,
}: WorldLanguageMapProps) {
  const fills = useMemo(() => {
    const result = new Map<string, string>();
    for (const country of worldMap.countries) {
      const now = coverage(country.key, languages);
      const step = coverageStep(now);
      let fill: string = STEP_FILLS[step];
      if (preview) {
        const next = coverage(country.key, [...languages, preview]);
        // Only where the step would actually change: a language that nudges
        // Sweden from 90% to 97% should not light Sweden up.
        if (coverageStep(next) > step) fill = PREVIEW_FILL;
      }
      result.set(country.key, fill);
    }
    return result;
  }, [languages, preview]);

  const homeCountry = worldMap.countries.find((country) => country.key === home);
  const pinScale = 1 / viewScale(view);

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
      role="img"
      aria-label="Mapa świata: kraje, w których goście przeczytają Twoje menu"
      onMouseLeave={() => onHover(null)}
      sx={{ display: 'block', width: '100%', height: 'auto', overflow: 'hidden' }}
    >
      <g
        style={{
          transform: frame(view),
          transformOrigin: '0 0',
          transition: 'transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1)',
        }}
      >
        {worldMap.countries.map((country) => (
          <path
            key={country.key}
            data-country={country.key}
            d={country.d}
            fill={fills.get(country.key)}
            stroke={country.key === hovered ? '#1C1B1F' : '#FFFFFF'}
            strokeWidth={country.key === hovered ? 1.4 : 0.6}
            vectorEffect="non-scaling-stroke"
            onMouseEnter={() => onHover(country.key)}
            onClick={() => onPick(country.key)}
            style={{ cursor: 'pointer', transition: 'fill 0.35s ease' }}
          />
        ))}
        {homeCountry && (
          <g
            transform={`translate(${homeCountry.c[0]} ${homeCountry.c[1]}) scale(${pinScale})`}
            pointerEvents="none"
          >
            <circle r={9} fill="#0F8256" opacity={0.18} />
            <circle r={4.5} fill="#FFFFFF" />
            <circle r={3} fill="#0C6544" />
          </g>
        )}
      </g>
    </Box>
  );
}

export const WorldLanguageMap = memo(WorldLanguageMapComponent);
