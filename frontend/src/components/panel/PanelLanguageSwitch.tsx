import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import {
  PANEL_LANGUAGE_LABELS,
  isPanelLanguage,
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
 */
export function PanelLanguageSwitch({
  languages,
}: {
  languages: readonly PanelLanguage[];
}) {
  const { t, i18n } = usePanelT();

  if (languages.length < 2) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <LanguageRoundedIcon
        fontSize="small"
        sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}
        aria-hidden
      />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={i18n.language}
        onChange={(_event, value: unknown) => {
          if (isPanelLanguage(value)) setPanelLanguage(value);
        }}
        aria-label={t('language.switch')}
        sx={{
          bgcolor: 'background.paper',
          '& .MuiToggleButton-root': {
            px: 1.25,
            py: 0.4,
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: radii.pill,
          },
        }}
      >
        {languages.map((code) => (
          <ToggleButton key={code} value={code} lang={code}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              {PANEL_LANGUAGE_LABELS[code]}
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              {code.toUpperCase()}
            </Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
