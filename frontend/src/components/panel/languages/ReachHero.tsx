import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { getMenuLanguage } from '../../../constants/menuLanguages';
import { radii } from '../../../theme';
import worldMap from './worldCountries.json';
import { bestLanguageFor, coverage, formatPeople, gain, reach } from './reach';
import { WorldLanguageMap } from './WorldLanguageMap';
import { PREVIEW_FILL, STEP_FILLS, countryAnchor, type MapView } from './mapGeometry';

const WORLD_POPULATION = worldMap.countries.reduce(
  (sum, country) => sum + country.pop,
  0,
);

const LEGEND = [
  { fill: STEP_FILLS[3], label: 'prawie wszyscy' },
  { fill: STEP_FILLS[2], label: 'większość' },
  { fill: STEP_FILLS[1], label: 'część' },
  { fill: STEP_FILLS[0], label: 'mało kto' },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

interface ReachHeroProps {
  /** Languages guests can read the menu in, its own first. */
  languages: readonly string[];
  /** Catalogue languages not offered yet: what a click on the map may add. */
  candidates: readonly string[];
  /** A language considered elsewhere on the page (hovered in a list). */
  externalPreview: string | null;
  home: string;
  onAdd: (code: string) => void;
  onSelectLanguage: (code: string) => void;
}

/**
 * The headline: how many people can read this menu, and where they are.
 *
 * Hovering a country says how much of it reads the menu now and what one
 * click would add; the countries that language reaches light up before
 * anything is changed. That preview is the whole idea — the owner sees the
 * effect of a language before paying for it in work.
 */
export function ReachHero({
  languages,
  candidates,
  externalPreview,
  home,
  onAdd,
  onSelectLanguage,
}: ReachHeroProps) {
  const [view, setView] = useState<MapView>('world');
  const [hovered, setHovered] = useState<string | null>(null);

  const total = reach(worldMap.countries, languages);

  const hoveredCountry = hovered
    ? worldMap.countries.find((country) => country.key === hovered)
    : undefined;
  const suggestion =
    hovered && hovered !== home ? bestLanguageFor(hovered, languages, candidates) : null;
  const preview = externalPreview ?? suggestion?.code ?? null;
  const previewGain = preview ? gain(worldMap.countries, languages, preview) : 0;
  const anchor = hovered ? countryAnchor(hovered, view) : null;

  const pick = (key: string) => {
    if (key === home) return;
    const best = bestLanguageFor(key, languages, candidates);
    if (best) onAdd(best.code);
  };

  return (
    <Paper
      elevation={1}
      sx={{ borderRadius: radii.lg, p: { xs: 2, md: 3 }, overflow: 'hidden' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '300px minmax(0, 1fr)' },
          gap: { xs: 2, lg: 4 },
          alignItems: 'center',
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: 1 }}
            >
              Twoje menu przeczyta
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
              <Typography
                component="p"
                sx={{
                  fontSize: { xs: 44, md: 56 },
                  fontWeight: 800,
                  lineHeight: 1,
                  color: 'primary.main',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatPeople(total)}
              </Typography>
              <Typography variant="h6" component="span" color="text.secondary">
                ludzi
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              ok. {percent(total / WORLD_POPULATION)} mieszkańców świata, w{' '}
              {languages.length} {languages.length === 1 ? 'języku' : 'językach'}
            </Typography>
          </Box>

          {/* Fixed height, so the page does not jump as the preview comes and goes. */}
          <Box
            aria-live="polite"
            sx={{
              minHeight: 64,
              borderRadius: radii.md,
              px: 1.5,
              py: 1,
              bgcolor: preview ? alpha(PREVIEW_FILL, 0.18) : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
          >
            {preview ? (
              <>
                <Typography variant="subtitle2">
                  + {getMenuLanguage(preview)?.name}: {formatPeople(previewGain)} nowych
                  osób
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p">
                  {previewGain < 5e6
                    ? 'Niewiele — tamtejsi goście w większości przeczytają już Twoje menu.'
                    : `Razem ${formatPeople(total + previewGain)}. Na mapie na żółto — tam przybędzie czytelników.`}
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary" component="p">
                Najedź na kraj, żeby zobaczyć, ilu gości dołączy. Kliknij, żeby dodać jego
                język.
              </Typography>
            )}
          </Box>

          <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap' }}>
            {languages.map((code, index) => {
              const meta = getMenuLanguage(code);
              return (
                <Chip
                  key={code}
                  size="small"
                  label={meta?.endonym ?? code.toUpperCase()}
                  lang={code}
                  color={index === 0 ? 'default' : 'primary'}
                  variant={index === 0 ? 'outlined' : 'filled'}
                  onClick={index === 0 ? undefined : () => onSelectLanguage(code)}
                />
              );
            })}
          </Stack>
        </Stack>

        <Box>
          <Box
            sx={{
              position: 'relative',
              borderRadius: radii.md,
              overflow: 'hidden',
              bgcolor: '#F2F7FA',
            }}
          >
            <WorldLanguageMap
              languages={languages}
              preview={preview}
              hovered={hovered}
              view={view}
              home={home}
              onHover={setHovered}
              onPick={pick}
            />

            {hoveredCountry && anchor && (
              <Paper
                elevation={6}
                sx={{
                  position: 'absolute',
                  left: `${Math.min(Math.max(anchor.x * 100, 14), 86)}%`,
                  top: `${anchor.y * 100}%`,
                  // Above the country, unless it sits high on the map — then
                  // below, clear of the view switch in the corner.
                  transform:
                    anchor.y < 0.4
                      ? 'translate(-50%, 14px)'
                      : 'translate(-50%, calc(-100% - 10px))',
                  px: 1.5,
                  py: 1,
                  borderRadius: radii.sm,
                  pointerEvents: 'none',
                  maxWidth: 240,
                  zIndex: 2,
                }}
              >
                <Typography variant="subtitle2" noWrap>
                  {hoveredCountry.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p">
                  {formatPeople(hoveredCountry.pop)} mieszkańców · menu przeczyta{' '}
                  {percent(coverage(hoveredCountry.key, languages))}
                </Typography>
                <Typography
                  variant="caption"
                  component="p"
                  sx={{ fontWeight: 600, mt: 0.25 }}
                >
                  {hoveredCountry.key === home
                    ? 'Tu jest Twój lokal.'
                    : suggestion
                      ? `Kliknij, by dodać: ${getMenuLanguage(suggestion.code)?.name} → ${percent(
                          coverage(hoveredCountry.key, [...languages, suggestion.code]),
                        )}`
                      : coverage(hoveredCountry.key, languages) >= 0.85
                        ? 'Tu już czytają Twoje menu.'
                        : 'Tutejszego języka nie ma jeszcze w katalogu.'}
                </Typography>
              </Paper>
            )}

            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_event, value: MapView | null) => value && setView(value)}
              aria-label="Widok mapy"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'background.paper',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <ToggleButton value="world" sx={{ px: 1.5, py: 0.5 }}>
                <PublicRoundedIcon fontSize="small" sx={{ mr: 0.75 }} />
                Świat
              </ToggleButton>
              <ToggleButton value="europe" sx={{ px: 1.5, py: 0.5 }}>
                Europa
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Stack
            direction="row"
            useFlexGap
            spacing={2}
            sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Typography variant="caption" color="text.secondary">
              Czyta Twoje menu:
            </Typography>
            {LEGEND.map((entry) => (
              <Stack
                key={entry.label}
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center' }}
              >
                <Box
                  sx={{ width: 12, height: 12, borderRadius: '4px', bgcolor: entry.fill }}
                  aria-hidden
                />
                <Typography variant="caption" color="text.secondary">
                  {entry.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
}
