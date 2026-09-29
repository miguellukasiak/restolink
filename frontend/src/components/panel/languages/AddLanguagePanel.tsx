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
import { formatPeople, gain } from './reach';
import { PREVIEW_FILL } from './mapGeometry';

interface AddLanguagePanelProps {
  /** Read now, the menu's own language first. */
  languages: readonly string[];
  phrasesTotal: number;
  translated: (code: string) => number;
  busy: boolean;
  onAdd: (code: string) => void;
  onPreview: (code: string | null) => void;
}

type Tab = 'poland' | 'all';

/**
 * Where a language gets chosen on its merits.
 *
 * "Polecane w Polsce" leads, because what matters to a restaurant is who
 * walks in, not how many people speak a language somewhere — a kebab shop in
 * Stalowa Wola has more use for Ukrainian than for Hindi. "Wszystkie" sorts
 * by how many *new* people each language would add, which is also how the
 * screen talks the owner out of a long tail: Swedish after English adds a
 * couple of million, and the number says so.
 */
export function AddLanguagePanel({
  languages,
  phrasesTotal,
  translated,
  busy,
  onAdd,
  onPreview,
}: AddLanguagePanelProps) {
  const [tab, setTab] = useState<Tab>('poland');
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
    if (tab === 'poland') {
      return candidates
        .filter(({ language }) => language.tier)
        .sort((a, b) => (a.language.tier ?? 3) - (b.language.tier ?? 3));
    }
    const needle = query.trim().toLowerCase();
    return candidates
      .filter(
        ({ language }) =>
          !needle ||
          language.name.includes(needle) ||
          language.endonym.toLowerCase().includes(needle) ||
          language.code === needle,
      )
      .sort((a, b) => b.gain - a.gain);
  }, [candidates, tab, query]);

  return (
    <Stack spacing={1.5}>
      <Tabs
        value={tab}
        onChange={(_event, value: Tab) => setTab(value)}
        variant="fullWidth"
        sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none' } }}
      >
        <Tab value="poland" label="Polecane w Polsce" />
        <Tab value="all" label={`Wszystkie (${MENU_LANGUAGES.length})`} />
      </Tabs>

      {tab === 'all' && (
        <>
          <TextField
            size="small"
            placeholder="Szukaj języka"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            slotProps={{
              htmlInput: { 'aria-label': 'Szukaj języka' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Od największego zysku: ilu nowych ludzi przeczyta Twoje menu po dodaniu
            języka.
          </Typography>
        </>
      )}

      <Box
        onMouseLeave={() => onPreview(null)}
        sx={{ display: 'grid', gap: 1, maxHeight: 520, overflowY: 'auto', pr: 0.5 }}
      >
        {shown.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {tab === 'poland'
              ? 'Masz już wszystkie polecane języki. Inne znajdziesz w zakładce „Wszystkie”.'
              : 'Nie ma takiego języka w katalogu.'}
          </Typography>
        )}
        {shown.map(({ language, gain: people }) => (
          <Candidate
            key={language.code}
            language={language}
            people={people}
            prepared={translated(language.code)}
            phrasesTotal={phrasesTotal}
            showReason={tab === 'poland'}
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
  showReason,
  busy,
  onAdd,
  onHover,
}: {
  language: MenuLanguage;
  people: number;
  prepared: number;
  phrasesTotal: number;
  showReason: boolean;
  busy: boolean;
  onAdd: () => void;
  onHover: (on: boolean) => void;
}) {
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
            {language.name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            lang={language.code}
            dir="auto"
          >
            {language.endonym}
          </Typography>
        </Stack>
        {showReason && language.reason && (
          <Typography variant="caption" color="text.secondary" component="p">
            {language.reason}
          </Typography>
        )}
        {prepared > 0 && (
          <Typography variant="caption" color="success.main" component="p">
            Masz już {Math.min(prepared, phrasesTotal)} z {phrasesTotal} tłumaczeń — wrócą
            od razu.
          </Typography>
        )}
      </Box>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: people >= 5e6 ? 'primary.main' : 'text.secondary' }}
        title="Nowi czytelnicy menu po dodaniu tego języka"
      >
        +{formatPeople(people)}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddRoundedIcon />}
        disabled={busy}
        onClick={onAdd}
        aria-label={`Dodaj język: ${language.name}`}
        sx={{ flexShrink: 0 }}
      >
        Dodaj
      </Button>
    </Box>
  );
}
