import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import type { PublicMenuItem } from '../../types';
import { formatPln } from '../../constants/menu';

/** Card corner radius, in px. A string — `borderRadius: 16` in `sx` is a
 *  multiplier against theme.shape.borderRadius, not pixels. */
const CARD_RADIUS = '16px';

interface PublicItemCardProps {
  item: PublicMenuItem;
  /** Omitted in the read-only settings preview. */
  onOpen?: (item: PublicMenuItem) => void;
}

/**
 * Client-facing dish card, sized for a dense two-up grid on a phone.
 *
 * The layout is the delivery-app convention: a square photo edge to edge, then
 * name, description and price in a tight block beneath it. Type is deliberately
 * small (14px name, 12px description) because at this width a larger scale
 * wraps every second name onto a third line and costs a whole row of dishes.
 *
 * Colors all come from the palette rather than fixed greys: the public menu's
 * text colors are computed at runtime from the restaurant's background
 * luminance, so a hardcoded grey would turn unreadable on a dark menu.
 *
 * Unavailable dishes stay visible but are greyed out, unclickable, and flagged
 * with a badge (also announced to screen readers via the action-area label).
 *
 * Wrapped in `React.memo` (see export): a menu can have dozens of these, and
 * every allergy-filter toggle / search keystroke re-renders the parent list.
 */
function PublicItemCardComponent({ item, onOpen }: PublicItemCardProps) {
  const { t } = useTranslation();
  const available = item.is_available !== false;
  const interactive = available && Boolean(onOpen);

  const allergensText =
    item.allergens.length > 0 ? item.allergens.join(', ') : t('noAllergens');
  const ariaLabel = `${t('openDish', {
    name: item.name,
    price: formatPln(item.price),
  })}. ${t('allergens')}: ${allergensText}.${
    available ? '' : ` ${t('unavailable')}.`
  }`;

  return (
    <Card
      component="article"
      elevation={0}
      sx={{
        bgcolor: 'transparent',
        borderRadius: CARD_RADIUS,
        height: '100%',
      }}
    >
      <CardActionArea
        onClick={interactive ? () => onOpen?.(item) : undefined}
        disabled={!interactive}
        aria-label={ariaLabel}
        aria-disabled={!available}
        sx={{
          borderRadius: CARD_RADIUS,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          overflow: 'hidden',
          '&.Mui-disabled': { opacity: 1 },
          // MUI's default rectangular focus wash competes with the image
          // treatment below — suppress it and drive the hover from the image.
          '& .MuiCardActionArea-focusHighlight': { opacity: 0 },
          '& .dish-media': { transition: 'transform 0.35s ease' },
          '& .dish-overlay': { opacity: 0, transition: 'opacity 0.25s ease' },
          ...(interactive
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
            width: '100%',
            aspectRatio: '1 / 1',
            // Top corners only: the photo meets the text block below it flush.
            borderRadius: `${CARD_RADIUS} ${CARD_RADIUS} 0 0`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
            color: (theme) => alpha(theme.palette.primary.main, 0.3),
            ...(available ? {} : { opacity: 0.5, filter: 'grayscale(100%)' }),
          }}
        >
          {item.image_url ? (
            <Box
              component="img"
              className="dish-media"
              src={item.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 'inherit',
              }}
            />
          ) : (
            <RestaurantMenuRoundedIcon className="dish-media" sx={{ fontSize: 36 }} />
          )}

          {/* Hover darken that follows the image's top-rounded shape exactly:
              fills the clipped parent and inherits its radius, so it can never
              bleed past the corners. */}
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
                top: 6,
                right: 6,
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}

          {!available && (
            <Chip
              label={t('unavailable')}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.92),
                color: 'text.secondary',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>

        <Box sx={{ px: 1, pt: 0.75, pb: 1, width: '100%', minWidth: 0 }}>
          <Typography
            component="h3"
            sx={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.25,
              color: available ? 'text.primary' : 'text.disabled',
              // Two lines maximum: dish names are wildly uneven in length, and
              // letting one run to four lines knocks its whole row out of
              // alignment with the next.
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {item.name}
          </Typography>

          {item.description && (
            <Typography
              sx={{
                mt: 0.25,
                fontSize: 12,
                lineHeight: 1.35,
                color: 'text.secondary',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {item.description}
            </Typography>
          )}

          <Typography
            sx={{
              mt: 0.5,
              fontSize: 14,
              fontWeight: 700,
              color: available ? 'text.primary' : 'text.disabled',
            }}
          >
            {formatPln(item.price)}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}

export const PublicItemCard = memo(PublicItemCardComponent);
