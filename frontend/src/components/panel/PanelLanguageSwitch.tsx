import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import {
  isPanelLanguage,
  panelLanguageLabel,
  setPanelLanguage,
  usePanelT,
  type PanelLanguage,
} from '../../i18n/panel';
import { radii } from '../../theme';

/**
 * The panel's language switch: English and the one other language HQ gave
 * this restaurant. Hidden when there is only English. Shown with the
 * languages' own names ("Polski"), so the owner finds theirs whichever one
 * the panel is in right now.
 *
 * A segmented control — one soft track, the chosen language raised on it
 * like a key that is down — rather than two outlined buttons with a globe
 * beside them: the names already say what the switch is for.
 */
export function PanelLanguageSwitch({
  languages,
}: {
  languages: readonly PanelLanguage[];
}) {
  const { t, i18n } = usePanelT();

  if (languages.length < 2) return null;

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={i18n.language}
      onChange={(_event, value: unknown) => {
        if (isPanelLanguage(value)) setPanelLanguage(value);
      }}
      aria-label={t('language.switch')}
      sx={{
        p: '3px',
        gap: '2px',
        borderRadius: radii.pill,
        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
        '& .MuiToggleButtonGroup-grouped': {
          border: 0,
          m: 0,
          borderRadius: `${radii.pill} !important`,
        },
        '& .MuiToggleButton-root': {
          px: { xs: 1.25, sm: 1.75 },
          py: 0.5,
          minHeight: 30,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.2,
          textTransform: 'none',
          color: 'text.secondary',
          transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.05),
            color: 'text.primary',
          },
          '&.Mui-selected, &.Mui-selected:hover': {
            bgcolor: 'background.paper',
            color: 'text.primary',
            boxShadow:
              '0 1px 3px rgba(22, 28, 37, 0.16), 0 1px 1px rgba(22, 28, 37, 0.06)',
          },
        },
      }}
    >
      {languages.map((code) => (
        <ToggleButton key={code} value={code} lang={code}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {panelLanguageLabel(code)}
          </Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            {code.toUpperCase()}
          </Box>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
