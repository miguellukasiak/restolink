import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import HideImageRoundedIcon from '@mui/icons-material/HideImageRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import type { MenuCategory } from '../../types';
import { radii } from '../../theme';
import { usePanelT } from '../../i18n/panel';

/** Which dishes the board is narrowed to. */
export type DishFilter = 'all' | 'no-photo' | 'no-description' | 'unavailable';

interface MenuReadinessProps {
  categories: MenuCategory[];
  filter: DishFilter;
  onFilterChange: (filter: DishFilter) => void;
}

/**
 * How finished the menu looks to a guest, as one number.
 *
 * Counts the two things that most change whether a dish gets ordered — a
 * photo and a description — and turns the gaps into filters, so "6 dishes
 * have no photo" is one tap from being the list to work through. Allergens
 * are deliberately not scored: "no allergens" is a legitimate answer, and a
 * meter that nagged about it would push owners to tick boxes to make it stop.
 */
export function MenuReadiness({
  categories,
  filter,
  onFilterChange,
}: MenuReadinessProps) {
  const { t } = usePanelT();
  const dishes = categories.flatMap((category) => category.items);
  if (dishes.length === 0) return null;

  const withoutPhoto = dishes.filter((dish) => !dish.image_url).length;
  const withoutDescription = dishes.filter((dish) => !dish.description.trim()).length;
  const unavailable = dishes.filter((dish) => !dish.is_available).length;
  const score = Math.round(
    (100 * (dishes.length * 2 - withoutPhoto - withoutDescription)) / (dishes.length * 2),
  );
  const complete = score === 100;

  const missing = [
    withoutPhoto > 0 && t('readiness.photos', { count: withoutPhoto }),
    withoutDescription > 0 && t('readiness.descriptions', { count: withoutDescription }),
  ].filter(Boolean);

  const title = complete
    ? t('readiness.complete')
    : score >= 70
      ? t('readiness.ready', { score })
      : t('readiness.readyLow', { score });
  const hint = complete
    ? t('readiness.completeHint')
    : t('readiness.missingHint', { list: missing.join(t('readiness.and')) });

  const toggle = (next: DishFilter) => onFilterChange(filter === next ? 'all' : next);

  return (
    <Paper elevation={1} sx={{ borderRadius: radii.lg, p: 2, pr: { sm: 2.5 } }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={56}
            thickness={5}
            sx={{
              position: 'absolute',
              color: (t) => alpha(t.palette.primary.main, 0.12),
            }}
            aria-hidden
          />
          <CircularProgress
            variant="determinate"
            value={score}
            size={56}
            thickness={5}
            aria-label={t('readiness.ready', { score })}
            sx={{ position: 'absolute', '& circle': { strokeLinecap: 'round' } }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.main',
            }}
            aria-hidden
          >
            {complete ? (
              <AutoAwesomeRoundedIcon fontSize="small" />
            ) : (
              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{score}%</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            component="p"
            sx={{ fontWeight: 700, lineHeight: 1.3 }}
          >
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>

          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap', mt: 1.5 }}
          >
            {withoutPhoto > 0 && (
              <Chip
                icon={<HideImageRoundedIcon />}
                label={t('readiness.noPhoto', { count: withoutPhoto })}
                clickable
                onClick={() => toggle('no-photo')}
                aria-pressed={filter === 'no-photo'}
                color={filter === 'no-photo' ? 'primary' : 'default'}
                variant={filter === 'no-photo' ? 'filled' : 'outlined'}
              />
            )}
            {withoutDescription > 0 && (
              <Chip
                icon={<NotesRoundedIcon />}
                label={t('readiness.noDescription', { count: withoutDescription })}
                clickable
                onClick={() => toggle('no-description')}
                aria-pressed={filter === 'no-description'}
                color={filter === 'no-description' ? 'primary' : 'default'}
                variant={filter === 'no-description' ? 'filled' : 'outlined'}
              />
            )}
            {unavailable > 0 && (
              <Chip
                icon={<VisibilityOffRoundedIcon />}
                label={t('readiness.unavailable', { count: unavailable })}
                clickable
                onClick={() => toggle('unavailable')}
                aria-pressed={filter === 'unavailable'}
                color={filter === 'unavailable' ? 'primary' : 'default'}
                variant={filter === 'unavailable' ? 'filled' : 'outlined'}
              />
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
