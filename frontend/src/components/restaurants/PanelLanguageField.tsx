import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { PANEL_DEFAULT_LANGUAGE, PANEL_LANGUAGES } from '../../i18n/panel';
import { panelLanguageLabel } from './panelLanguageLabel';

/** The languages HQ can add to English: every one the panel is translated into. */
const SECOND_LANGUAGES = PANEL_LANGUAGES.filter(
  (code) => code !== PANEL_DEFAULT_LANGUAGE,
);

/**
 * "Dodatkowy język panelu" — HQ's half of the owner panel's language switch.
 *
 * Every owner panel is English. The language picked here is the one other
 * language its switch offers, and the one the owner's emails are written in.
 * Empty means English only; the form sends that as `null`.
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
  return (
    <TextField
      select
      label="Dodatkowy język panelu"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
      disabled={disabled}
      helperText="Panel restauratora jest po angielsku. Wybrany język pojawi się obok w przełączniku u góry, a maile do restauratora pójdą w tym języku."
    >
      <MenuItem value="">Brak — tylko angielski</MenuItem>
      {SECOND_LANGUAGES.map((code) => (
        <MenuItem key={code} value={code}>
          {panelLanguageLabel(code)}
        </MenuItem>
      ))}
    </TextField>
  );
}
