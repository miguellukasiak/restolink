import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  PANEL_DEFAULT_LANGUAGE,
  PANEL_LANGUAGES,
  panelLanguageLabel,
} from '../../i18n/panel';
import { useAdminPanelLocales } from '../../hooks/usePanelLocales';
import {
  panelLanguageState,
  type PanelLanguageState,
} from '../../services/panelTranslation';
import { panelLanguageLabel as polishName } from './panelLanguageLabel';

/** "" for English only, then every language the panel can have. */
const OPTIONS = [
  '',
  ...PANEL_LANGUAGES.filter((code) => code !== PANEL_DEFAULT_LANGUAGE),
];

const STATE_LABEL: Record<PanelLanguageState, string> = {
  'built-in': 'przetłumaczony ręcznie',
  ready: 'gotowy',
  missing: 'DeepL przetłumaczy po zapisie',
};

/** "Ukraiński · Українська" — and "Polski" once, not twice. */
const label = (code: string) => {
  if (!code) return 'Brak — tylko angielski';
  const own = panelLanguageLabel(code);
  const name = polishName(code);
  return name.toLocaleLowerCase('pl') === own.toLocaleLowerCase('pl')
    ? name
    : `${name} · ${own}`;
};

/**
 * "Dodatkowy język panelu" — HQ's half of the owner panel's language switch.
 *
 * Every owner panel is English. The language picked here is the one other
 * language its switch offers, and the one the owner's emails and the
 * server's messages are written in. Polish is translated by hand; any other
 * catalogue language is translated by DeepL once, after the first save that
 * chooses it, and then shared by every restaurant with that language. Empty
 * means English only; the form sends that as `null`.
 */
export function PanelLanguageField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const statuses = useAdminPanelLocales();
  const state = (code: string) => panelLanguageState(code, statuses.data);

  const hint = !value
    ? 'Panel restauratora jest po angielsku. Wybrany język pojawi się obok w przełączniku u góry, a maile i komunikaty pójdą w tym języku.'
    : state(value) === 'missing'
      ? 'Panel w tym języku nie jest jeszcze gotowy — po zapisie DeepL przetłumaczy go w ok. pół minuty, raz dla wszystkich restauracji.'
      : 'Panel w tym języku jest gotowy. Restaurator zobaczy go w przełączniku u góry.';

  return (
    <Autocomplete
      options={OPTIONS}
      value={value}
      onChange={(_event, next) => onChange(next ?? '')}
      getOptionLabel={label}
      disableClearable
      disabled={disabled}
      autoHighlight
      renderOption={({ key, ...props }, code) => (
        <Box component="li" key={key} {...props} sx={{ gap: 1 }}>
          <Typography sx={{ flex: 1 }}>{label(code)}</Typography>
          {code && (
            <Chip
              size="small"
              label={STATE_LABEL[state(code)]}
              color={state(code) === 'missing' ? 'default' : 'success'}
              variant={state(code) === 'missing' ? 'outlined' : 'filled'}
            />
          )}
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} label="Dodatkowy język panelu" helperText={hint} />
      )}
    />
  );
}
