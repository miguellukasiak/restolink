import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { usePanelT } from '../../i18n/panel';

/**
 * What the panel's previews show where the dishes go while the menu has
 * none: rendered inside the restaurant's theme, so it sits on the menu's own
 * background in its own muted text colour.
 */
export function EmptyMenuPreview({ hint }: { hint?: string }) {
  const { t } = usePanelT();
  return (
    <Stack
      spacing={1.5}
      sx={{ alignItems: 'center', pt: 14, px: 4, color: 'text.secondary' }}
    >
      <MenuBookRoundedIcon sx={{ fontSize: 56, opacity: 0.35 }} />
      <Typography sx={{ fontSize: 17, fontWeight: 600, textAlign: 'center' }}>
        {t('preview.emptyMenu')}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: 14, textAlign: 'center', maxWidth: 280 }}>
          {hint}
        </Typography>
      )}
    </Stack>
  );
}
