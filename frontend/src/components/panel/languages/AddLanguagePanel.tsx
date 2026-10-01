import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { MENU_LANGUAGES, type MenuLanguage } from '../../../constants/menuLanguages';
import { radii } from '../../../theme';
import worldMap from './worldCountries.json';
import { countryName, formatPeople, gain, nearbyLanguages } from './reach';
import { PREVIEW_FILL } from './mapGeometry';
import { useLanguageName, usePanelT } from '../../../i18n/panel';

interface AddLanguagePanelProps {
  /** Where the restaurant is (ISO 3166-1 alpha-2). */
  country: string;
  /** Read now, the menu's own language first. */
  languages: readonly string[];
  phrasesTotal: number;
  translated: (code: string) => number;
  busy: boolean;
  onAdd: (code: string) => void;
  onPreview: (code: string | null) => void;
}

type Tab = 'recommended' | 'all';

/**
 * Where a language gets chosen on its merits.
 *
 * The recommendations lead, because what matters to a restaurant is who
 * walks in, not how many people speak a language somewhere — a kebab shop in
 * Stalowa Wola has more use for Ukrainian than for Hindi. In Poland they are
 * a hand-made list with a reason each ("Polecane w Polsce"); anywhere else
 * they are the languages that bring the most new readers from nearby
 * countries (`nearbyLanguages`), each saying where it is read — no invented
 * reasons for places nobody has written any for. "Wszystkie" sorts by how
 * many *new* people each language would add, which is also how the screen
 * talks the owner out of a long tail: Swedish after English adds a couple of
 * million, and the number says so.
 */
export function AddLanguagePanel({
  country,
  languages,
  phrasesTotal,
  translated,
  busy,
  onAdd,
  onPreview,
}: AddLanguagePanelProps) {
  const { t, i18n } = usePanelT();
  const languageName = useLanguageName();
  const [tab, setTab] = useState<Tab>('recommended');
  const inPoland = country === 'PL';

  // Outside Poland: the codes worth adding, and where each is read.
  const nearby = useMemo(
    () =>
      inPoland
        ? null
        : new Map(
            nearbyLanguages(
              worldMap.countries,
              country,
              languages,
              MENU_LANGUAGES.map((language) => language.code),
            ).map((entry, rank) => [entry.code, { rank, readIn: entry.readIn }]),
          ),
    [inPoland, country, languages],
  );
  const [query, setQuery] = useState('');

  const candidates = useMemo(
    () =>
      MENU_LANGUAGES.filter((language) => !languages.includes(language.code)).map(
        (language) => ({
          language,
          gain: gain(worldMap.countries, languages, language.code),
        }),
      ),
    [languages],
  );

  const shown = useMemo(() => {
    if (tab === 'recommended') {
      if (nearby) {
        return candidates
          .filter(({ language }) => nearby.has(language.code))
          .sort(
            (a, b) =>
              (nearby.get(a.language.code)?.rank ?? 0) -
              (nearby.get(b.language.code)?.rank ?? 0),
          );
      }
      return candidates
        .filter(({ language }) => language.tier)
        .sort((a, b) => (a.language.tier ?? 3) - (b.language.tier ?? 3));
    }
    const needle = query.trim().toLowerCase();
    return candidates
      .filter(
        ({ language }) =>
          !needle ||
          languageName(language.code).toLowerCase().includes(needle) ||
          language.endonym.toLowerCase().includes(needle) ||
          language.code === needle,
      )
      .sort((a, b) => b.gain - a.gain);
  }, [candidates, tab, query, languageName, nearby]);

  /** Why a language is recommended: Poland's own reason, or where it is read. */
  const reasonFor = (language: MenuLanguage) => {
    if (tab !== 'recommended') return null;
    if (!nearby) return language.reason ? t(`languages.reason.${language.code}`) : null;
    const where = nearby.get(language.code)?.readIn ?? [];
    if (where.length === 0) return null;
    return t('addLanguage.readNearby', {
      countries: where
        .map((key) =>
          countryName(
            key,
            worldMap.countries.find((entry) => entry.key === key)?.name ?? key,
            i18n.language,
          ),
        )
        .join(', '),
    });
  };

  return (
    <Stack spacing={1.5}>
      <Tabs
        value={tab}
        onChange={(_event, value: Tab) => setTab(value)}
        variant="fullWidth"
        sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none' } }}
      >
        <Tab
          value="recommended"
          label={
            inPoland ? t('addLanguage.recommended') : t('addLanguage.recommendedNearby')
          }
        />
        <Tab
          value="all"
          label={t('addLanguage.all', { count: MENU_LANGUAGES.length - 1 })}
        />
      </Tabs>

      {tab === 'all' && (
        <>
          <TextField
            size="small"
            placeholder={t('addLanguage.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            slotProps={{
              htmlInput: { 'aria-label': t('addLanguage.search') },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Typography variant="caption" color="textSecondary">
            {t('addLanguage.sortHint')}
          </Typography>
        </>
      )}

      <Box
        onMouseLeave={() => onPreview(null)}
        sx={{ display: 'grid', gap: 1, maxHeight: 520, overflowY: 'auto', pr: 0.5 }}
      >
        {shown.length === 0 && (
          <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
            {tab === 'recommended'
              ? t('addLanguage.allRecommended')
              : t('addLanguage.noSuch')}
          </Typography>
        )}
        {shown.map(({ language, gain: people }) => (
          <Candidate
            key={language.code}
            language={language}
            people={people}
            prepared={translated(language.code)}
            phrasesTotal={phrasesTotal}
            reason={reasonFor(language)}
            busy={busy}
            onAdd={() => onAdd(language.code)}
            onHover={(on) => onPreview(on ? language.code : null)}
          />
        ))}
      </Box>
    </Stack>
  );
}

function Candidate({
  language,
  people,
  prepared,
  phrasesTotal,
  reason,
  busy,
  onAdd,
  onHover,
}: {
  language: MenuLanguage;
  people: number;
  prepared: number;
  phrasesTotal: number;
  reason: string | null;
  busy: boolean;
  onAdd: () => void;
  onHover: (on: boolean) => void;
}) {
  const { t, i18n } = usePanelT();
  const languageName = useLanguageName();
  const name = languageName(language.code);
  return (
    <Box
      onMouseEnter={() => onHover(true)}
      onFocus={() => onHover(true)}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 1.5,
        rowGap: 0.75,
        px: 1.5,
        py: 1.25,
        borderRadius: radii.md,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        '&:hover': {
          bgcolor: alpha(PREVIEW_FILL, 0.12),
          borderColor: alpha(PREVIEW_FILL, 0.8),
        },
      }}
    >
      {/* Wide enough to keep the reason readable; the figure and the button
          wrap under it on a phone. */}
      <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
        >
          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
            {name}
          </Typography>
          {/* Its own name, unless that is the name just shown ("English"). */}
          {language.endonym.toLowerCase() !== name.toLowerCase() && (
            <Typography
              variant="caption"
              color="textSecondary"
              lang={language.code}
              dir="auto"
            >
              {language.endonym}
            </Typography>
          )}
        </Stack>
        {reason && (
          <Typography variant="caption" color="textSecondary" component="p">
            {reason}
          </Typography>
        )}
        {prepared > 0 && (
          <Typography variant="caption" color="success.main" component="p">
            {t('addLanguage.prepared', {
              done: Math.min(prepared, phrasesTotal),
              total: phrasesTotal,
            })}
          </Typography>
        )}
      </Box>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: people >= 5e6 ? 'primary.main' : 'text.secondary' }}
        title={t('addLanguage.gainTitle')}
      >
        +{formatPeople(people, i18n.language)}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddRoundedIcon />}
        disabled={busy}
        onClick={onAdd}
        aria-label={t('addLanguage.addAria', { name: languageName(language.code) })}
        sx={{ flexShrink: 0 }}
      >
        {t('common.add')}
      </Button>
    </Box>
  );
}
