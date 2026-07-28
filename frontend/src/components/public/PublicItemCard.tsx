import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import type { PublicMenuItem } from '../../types';
import { formatPln } from '../../constants/menu';

interface PublicItemCardProps {
  item: PublicMenuItem;
  /** Omitted in the read-only settings preview. */
  onOpen?: (item: PublicMenuItem) => void;
}

/**
 * Client-facing dish card. Unavailable dishes stay visible but are greyed out,
 * unclickable, and flagged with a "Niedostępne" badge (also announced to
 * screen readers via the action-area label).
 */
export function PublicItemCard({ item, onOpen }: PublicItemCardProps) {
  const { t } = useTranslation();
  const available = item.is_available !== false;

  const allergensText =
    item.allergens.length > 0 ? item.allergens.join(', ') : t('noAllergens');
  const ariaLabel = `${t('openDish', {
    name: item.name,
    price: formatPln(item.price),
  })}. ${t('allergens')}: ${allergensText}.${
    available ? '' : ` ${t('unavailable')}.`
  }`;

  return (
    <Card component="article" elevation={0} sx={{ bgcolor: 'transparent' }}>
      <CardActionArea
        onClick={available && onOpen ? () => onOpen(item) : undefined}
        disabled={!available || !onOpen}
        aria-label={ariaLabel}
        aria-disabled={!available}
        sx={{
          borderRadius: 5,
          p: 0.5,
          overflow: 'hidden',
          '&.Mui-disabled': { opacity: 1 },
          // MUI's default rectangular focus wash competes with the image
          // treatment below — suppress it and drive the hover from the image.
          '& .MuiCardActionArea-focusHighlight': { opacity: 0 },
          // Gently zoom the photo and reveal a shape-matched darken overlay
          // (see .dish-media / .dish-overlay) only while the card is hovered
          // or keyboard-focused, and only when the dish is actually orderable.
          '& .dish-media': { transition: 'transform 0.35s ease' },
          '& .dish-overlay': { opacity: 0, transition: 'opacity 0.25s ease' },
          ...(available && onOpen
            ? {
                '&:hover .dish-media, &.Mui-focusVisible .dish-media': {
                  transform: 'scale(1.05)',
                },
                '&:hover .dish-overlay, &.Mui-focusVisible .dish-overlay': {
                  opacity: 1,
                },
              }
            : {}),
        }}
      >
        <Box
          role="img"
          aria-label={t('dishImage', { name: item.name })}
          sx={{
            position: 'relative',
            aspectRatio: '1 / 1',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
            color: (theme) => alpha(theme.palette.primary.main, 0.3),
            ...(available
              ? {}
              : { opacity: 0.5, filter: 'grayscale(100%)' }),
          }}
        >
          {item.image_url ? (
            <Box
              component="img"
              className="dish-media"
              src={item.image_url}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <RestaurantMenuRoundedIcon className="dish-media" sx={{ fontSize: 44 }} />
          )}
          {/* Hover darken that perfectly follows the image's rounded-square
              boundary: absolutely fills the clipped parent and inherits its
              border-radius, so it can never bleed out as a stray rectangle/circle. */}
          <Box
            className="dish-overlay"
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              bgcolor: 'rgba(0, 0, 0, 0.16)',
              pointerEvents: 'none',
            }}
          />
          {item.tags.includes('Nowość') && available && (
            <Chip
              label="NEW"
              size="small"
              color="primary"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                height: 22,
                fontSize: 11,
                fontWeight: 700,
              }}
            />
          )}
        </Box>
        <Box sx={{ px: 1, pt: 1, pb: 0.75 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ color: available ? 'text.primary' : 'text.disabled', minWidth: 0 }}
            >
              {item.name}
            </Typography>
            {!available && (
              <Chip
                label={t('unavailable')}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
                  color: 'text.secondary',
                }}
              />
            )}
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: available ? 'text.secondary' : 'text.disabled' }}
          >
            {formatPln(item.price)}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}
