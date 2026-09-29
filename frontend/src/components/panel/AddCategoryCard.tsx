import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import { radii } from '../../theme';
import { TonalIcon } from './TonalIcon';
import { usePanelT } from '../../i18n/panel';

interface AddCategoryCardProps {
  /** Names worth offering — the caller leaves out the ones already used. */
  suggestions: string[];
  busy: boolean;
  onQuickAdd: (name: string) => void;
  onCustom: () => void;
}

/**
 * The foot of the board. Most menus open with the same few sections, so the
 * common ones are a tap away; anything else goes through the naming dialog.
 */
export function AddCategoryCard({
  suggestions,
  busy,
  onQuickAdd,
  onCustom,
}: AddCategoryCardProps) {
  const { t } = usePanelT();
  return (
    <Box
      sx={{
        borderRadius: radii.lg,
        border: '1.5px dashed',
        borderColor: (t) => alpha(t.palette.primary.main, 0.3),
        p: { xs: 2, sm: 2.5 },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <TonalIcon size={40}>
          <PlaylistAddRoundedIcon />
        </TonalIcon>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            {t('addCategory.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {suggestions.length > 0
              ? t('addCategory.pickOrName')
              : t('addCategory.nameNew')}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
        {suggestions.map((name) => (
          <Chip
            key={name}
            label={name}
            icon={<AddRoundedIcon />}
            variant="outlined"
            clickable
            disabled={busy}
            onClick={() => onQuickAdd(name)}
            aria-label={t('addCategory.quickAdd', { name })}
            sx={{
              height: 36,
              px: 0.5,
              bgcolor: 'background.paper',
              '& .MuiChip-icon': { color: 'primary.main', fontSize: 18 },
            }}
          />
        ))}
        <Button
          size="small"
          onClick={onCustom}
          disabled={busy}
          sx={{ height: 36, px: 2 }}
        >
          {t('addCategory.customName')}
        </Button>
      </Box>
    </Box>
  );
}
