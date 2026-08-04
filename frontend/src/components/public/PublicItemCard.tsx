import { memo } from 'react';
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
 *
 * Wrapped in `React.memo` (see export): a menu can have dozens of these, and
 * every allergy-filter toggle / search keystroke re-renders the parent list.
 * With a stable `item` reference and a stable `onOpen` (memoized upstream),
 * memo lets untouched cards skip re-rendering entirely.
 */
function PublicItemCardComponent({ item, onOpen }: PublicItemCardProps) {
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
          // Fixed px, NOT the sx multiplier: `borderRadius: 5` resolved to
          // 5 × theme.shape.borderRadius (16) = 80px, and with overflow:hidden
          // those giant bottom corners sliced through the price text. Clamp to a
          // sane Material 3 value so the card can never become a text-eating pill.
          borderRadius: '24px',
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
            // Round only the TOP corners, matching the card's clamped 24px radius;
            // the bottom stays flat so the image meets the text block below it
            // seamlessly. (Was `borderRadius: 4` → 4 × theme.shape (16) = 64px,
            // which ballooned the image into a circle AND whose heavy corners
            // clipped the absolutely-positioned "NEW" badge.)
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
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
            <RestaurantMenuRoundedIcon className="dish-media" sx={{ fontSize: 44 }} />
          )}
          {/* Hover darken that perfectly follows the image's top-rounded shape:
              absolutely fills the clipped parent and inherits its border-radius
              (top corners rounded, bottom flat), so it can never bleed out. */}
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
                // Safe inset from the corner so the badge sits inside the visible
                // area and clears the top-right rounded corner (24px) cleanly.
                top: 10,
                right: 10,
                height: 22,
                fontSize: 11,
                fontWeight: 700,
              }}
            />
          )}
        </Box>
        {/* Extra bottom padding keeps the price clear of the card's rounded
            bottom corners even at the maximum clamped radius (see above). */}
        <Box sx={{ px: 1, pt: 1, pb: 2 }}>
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

export const PublicItemCard = memo(PublicItemCardComponent);
