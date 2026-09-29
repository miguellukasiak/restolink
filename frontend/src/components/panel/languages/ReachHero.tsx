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
import { useLanguageName, usePanelT } from '../../../i18n/panel';
import { radii } from '../../../theme';
import worldMap from './worldCountries.json';
import {
  bestLanguageFor,
  countryName,
  coverage,
  formatPeople,
  gain,
  reach,
} from './reach';
import { WorldLanguageMap } from './WorldLanguageMap';
import { PREVIEW_FILL, STEP_FILLS, countryAnchor, type MapView } from './mapGeometry';

const WORLD_POPULATION = worldMap.countries.reduce(
  (sum, country) => sum + country.pop,
  0,
);

/** Coverage steps, most first; worded by `reach.legend.<step>`. */
const LEGEND = [3, 2, 1, 0] as const;

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
  const { t, i18n } = usePanelT();
  const languageName = useLanguageName();
  const locale = i18n.language;
  const people = (value: number) => formatPeople(value, locale);
  const percent = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
      value,
    );
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
              {t('reach.readBy')}
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
                {people(total)}
              </Typography>
              <Typography variant="h6" component="span" color="text.secondary">
                {t('reach.people')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t('reach.worldShare', {
                percent: percent(total / WORLD_POPULATION),
                inLanguages: t('reach.inLanguages', { count: languages.length }),
              })}
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
                  {t('reach.preview', {
                    name: languageName(preview),
                    people: people(previewGain),
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p">
                  {previewGain < 5e6
                    ? t('reach.previewSmall')
                    : t('reach.previewTotal', { total: people(total + previewGain) })}
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary" component="p">
                {t('reach.hint')}
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
                  {countryName(
                    hoveredCountry.key,
                    t(`reach.country.${hoveredCountry.key}`, {
                      defaultValue: hoveredCountry.name,
                    }),
                    locale,
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p">
                  {t('reach.countryStats', {
                    people: people(hoveredCountry.pop),
                    percent: percent(coverage(hoveredCountry.key, languages)),
                  })}
                </Typography>
                <Typography
                  variant="caption"
                  component="p"
                  sx={{ fontWeight: 600, mt: 0.25 }}
                >
                  {hoveredCountry.key === home
                    ? t('reach.home')
                    : suggestion
                      ? t('reach.clickToAdd', {
                          name: languageName(suggestion.code),
                          percent: percent(
                            coverage(hoveredCountry.key, [...languages, suggestion.code]),
                          ),
                        })
                      : coverage(hoveredCountry.key, languages) >= 0.85
                        ? t('reach.alreadyRead')
                        : t('reach.notInCatalogue')}
                </Typography>
              </Paper>
            )}

            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_event, value: MapView | null) => value && setView(value)}
              aria-label={t('reach.mapView')}
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
                {t('reach.world')}
              </ToggleButton>
              <ToggleButton value="europe" sx={{ px: 1.5, py: 0.5 }}>
                {t('reach.europe')}
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
              {t('reach.legendTitle')}
            </Typography>
            {LEGEND.map((step) => (
              <Stack
                key={step}
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center' }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '4px',
                    bgcolor: STEP_FILLS[step],
                  }}
                  aria-hidden
                />
                <Typography variant="caption" color="text.secondary">
                  {t(`reach.legend.${step}`)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
}
