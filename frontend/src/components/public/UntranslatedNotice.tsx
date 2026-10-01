import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { PublicMenuResponse } from '../../types';

const storageKey = (restaurantId: string, language: string) =>
  `restolink:untranslated-seen:${restaurantId}:${language}`;

function wasDismissed(restaurantId: string, language: string): boolean {
  try {
    return sessionStorage.getItem(storageKey(restaurantId, language)) === '1';
  } catch {
    return false;
  }
}

/**
 * One quiet line for a guest reading the menu in a language it is only
 * partly translated into: they meet English or the original among their own
 * language's dishes, and without a word it looks like a fault. Neutral on
 * purpose — the missing phrases need not be new, and the language may have
 * just been added. Counted against the chosen language alone, so a phrase
 * English covered still counts as missing.
 *
 * Written by hand in every guest locale, naming its own language. Closing
 * it lasts for the visit (this tab), per language.
 */
export function UntranslatedNotice({
  restaurantId,
  translation,
}: {
  restaurantId: string;
  translation: PublicMenuResponse['translation'];
}) {
  const { t } = useTranslation();
  const language = translation?.language ?? '';
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!translation || translation.phrases_translated >= translation.phrases_total) {
    return null;
  }
  if (dismissed === language || wasDismissed(restaurantId, language)) return null;

  const dismiss = () => {
    setDismissed(language);
    try {
      sessionStorage.setItem(storageKey(restaurantId, language), '1');
    } catch {
      // Private mode: it stays closed until the next reload, which is fine.
    }
  };

  return (
    <Stack
      role="note"
      direction="row"
      spacing={1}
      sx={{
        mt: 1.5,
        pl: 1.5,
        pr: 0.5,
        py: 0.5,
        alignItems: 'center',
        borderRadius: '12px',
        // Tinted with the menu's own text colour, so it stays a soft grey
        // on a light menu and a soft light band on a dark one.
        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
        color: 'text.secondary',
      }}
    >
      <TranslateRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} aria-hidden />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
        {t('untranslatedNotice')}
      </Typography>
      <IconButton
        size="small"
        aria-label={t('close')}
        onClick={dismiss}
        sx={{ color: 'inherit', flexShrink: 0 }}
      >
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
