import { forwardRef } from 'react';
import type { ReactElement, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import Slide from '@mui/material/Slide';
import type { TransitionProps } from '@mui/material/transitions';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { visuallyHidden } from '@mui/utils';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import type { PublicMenuItem } from '../../types';
import { formatPln } from '../../constants/menu';
import { getAllergenIcon, getTagIcon } from '../../constants/menuIcons';
import { useBackButtonClose } from '../../hooks/useBackButtonClose';

const SlideUp = forwardRef(function SlideUp(
  props: TransitionProps & { children: ReactElement },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ItemDetailModalProps {
  item: PublicMenuItem | null;
  open: boolean;
  onClose: () => void;
}

/** Large dish image (real photo when uploaded, gradient placeholder otherwise). */
function DishImage({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const { t } = useTranslation();
  return (
    <Box
      role="img"
      aria-label={t('dishImage', { name })}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: (theme) =>
          `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(
            theme.palette.primary.main,
            0.05,
          )})`,
        color: (theme) => alpha(theme.palette.primary.main, 0.3),
      }}
    >
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <RestaurantMenuRoundedIcon sx={{ fontSize: 96 }} />
      )}
    </Box>
  );
}

/** Detail content shared by the desktop and mobile layouts. */
function DetailBody({ item }: { item: PublicMenuItem }) {
  const { t } = useTranslation();

  const allergensText =
    item.allergens.length > 0 ? item.allergens.join(', ') : t('noAllergens');

  const nutritionTiles = item.nutrition
    ? [
        { label: t('kcal'), value: String(item.nutrition.kcal), highlight: true },
        { label: t('protein'), value: `${item.nutrition.protein_g}g`, highlight: false },
        { label: t('fat'), value: `${item.nutrition.fat_g}g`, highlight: false },
        { label: t('carbs'), value: `${item.nutrition.carbs_g}g`, highlight: false },
      ]
    : [];

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <Typography variant="h5" component="h2" id="dish-detail-title">
            {item.name}
          </Typography>
          <Typography
            variant="h5"
            component="p"
            aria-label={`${t('price')}: ${formatPln(item.price)}`}
            sx={{ color: 'primary.main', fontWeight: 800, whiteSpace: 'nowrap' }}
          >
            {formatPln(item.price)}
          </Typography>
        </Stack>
        {/* Read immediately after the title: name, price, then allergens. */}
        <Typography component="p" id="dish-detail-summary" sx={visuallyHidden}>
          {`${item.name}. ${t('price')}: ${formatPln(item.price)}. ${t(
            'allergens',
          )}: ${allergensText}.`}
        </Typography>
      </Box>

      {item.description && (
        <Box component="section" aria-labelledby="dish-detail-description">
          <Typography variant="h6" component="h3" id="dish-detail-description" gutterBottom>
            {t('description')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        </Box>
      )}

      {(item.ingredients || item.allergens.length > 0) && (
        <Box component="section" aria-labelledby="dish-detail-ingredients">
          <Typography variant="h6" component="h3" id="dish-detail-ingredients" gutterBottom>
            {`${t('ingredients')} i ${t('allergens').toLowerCase()}`}
          </Typography>
          {item.ingredients && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {item.ingredients}
            </Typography>
          )}
          {item.allergens.length > 0 && (
            <Stack
              direction="row"
              role="list"
              aria-label={t('allergens')}
              sx={{ flexWrap: 'wrap', gap: 1 }}
            >
              {item.allergens.map((allergen) => (
                <Chip
                  key={allergen}
                  role="listitem"
                  icon={getAllergenIcon(allergen)}
                  label={allergen}
                  variant="outlined"
                  sx={{
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                    borderColor: (theme) => alpha(theme.palette.warning.main, 0.4),
                    color: 'text.primary',
                    '& .MuiChip-icon': { color: 'warning.dark' },
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

      {item.tags.length > 0 && (
        <Box component="section" aria-label={t('tags')}>
          <Stack direction="row" role="list" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {item.tags.map((tag) => (
              <Chip
                key={tag}
                role="listitem"
                icon={getTagIcon(tag)}
                label={tag}
                variant="outlined"
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
                  borderColor: (theme) => alpha(theme.palette.success.main, 0.4),
                  color: 'text.primary',
                  '& .MuiChip-icon': { color: 'success.dark' },
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {nutritionTiles.length > 0 && (
        <Box component="section" aria-labelledby="dish-detail-nutrition">
          <Typography variant="h6" component="h3" id="dish-detail-nutrition" gutterBottom>
            {t('nutrition')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.5,
            }}
          >
            {nutritionTiles.map((tile) => (
              <Paper
                key={tile.label}
                elevation={0}
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                  textAlign: 'center',
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.045),
                }}
              >
                <Typography
                  variant="subtitle1"
                  component="p"
                  sx={{
                    fontWeight: 800,
                    color: tile.highlight ? 'primary.main' : 'text.primary',
                  }}
                >
                  {tile.value}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ letterSpacing: '0.08em' }}
                >
                  {tile.label}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}

/**
 * Dish detail view. Desktop: wide dialog, image filling the left, white card
 * overlapping it from the right. Mobile: full-screen bottom-sheet style — image
 * on top, rounded Paper sliding up over its lower edge.
 */
export function ItemDetailModal({ item, open, onClose }: ItemDetailModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Map the hardware/browser Back button to closing the modal (see hook).
  useBackButtonClose(open, onClose);

  if (!item) return null;

  // Desktop: solid pill over the split image/card layout.
  const closeButton = (
    <IconButton
      onClick={onClose}
      aria-label={t('close')}
      sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 2,
        bgcolor: 'background.paper',
        boxShadow: '0 4px 16px rgba(33, 26, 27, 0.16)',
        '&:hover': { bgcolor: 'background.paper' },
      }}
    >
      <CloseRoundedIcon />
    </IconButton>
  );

  // Mobile: fixed, blurred, dark-translucent — always visible & tappable over
  // the parallax image and the sheet, regardless of scroll position.
  const mobileCloseButton = (
    <IconButton
      onClick={onClose}
      aria-label={t('close')}
      sx={{
        position: 'fixed',
        top: 'calc(16px + env(safe-area-inset-top, 0px))',
        left: 16,
        zIndex: 20,
        color: '#fff',
        bgcolor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.55)' },
      }}
    >
      <CloseRoundedIcon />
    </IconButton>
  );

  if (isMobile) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        slots={{ transition: SlideUp }}
        aria-labelledby="dish-detail-title"
        aria-describedby="dish-detail-summary"
      >
        {mobileCloseButton}
        {/* One scroll container. The image is `sticky` so it stays pinned while
            the content sheet — pulled up over its lower edge with a higher
            z-index — slides up and covers it: the "bottom sheet over image"
            parallax you get in UberEats et al. */}
        <Box
          sx={{
            height: '100dvh',
            width: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative',
            bgcolor: 'background.default',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Box sx={{ position: 'sticky', top: 0, height: '40vh', zIndex: 0 }}>
            <DishImage name={item.name} imageUrl={item.image_url} />
          </Box>
          <Box
            sx={{
              position: 'relative',
              zIndex: 10,
              mt: '-32px',
              minHeight: '66vh',
              borderRadius: '32px 32px 0 0',
              bgcolor: 'background.paper',
              p: 3,
              pb: 'calc(32px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            <DetailBody item={item} />
          </Box>
        </Box>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="dish-detail-title"
      aria-describedby="dish-detail-summary"
    >
      <Box sx={{ position: 'relative', height: 560 }}>
        {closeButton}
        {/* Image fills the left side… */}
        <Box sx={{ position: 'absolute', inset: 0, right: '38%' }}>
          <DishImage name={item.name} imageUrl={item.image_url} />
        </Box>
        {/* …and the white card overlaps it from the right. */}
        <Card
          sx={{
            position: 'absolute',
            top: 24,
            bottom: 24,
            right: 24,
            left: '52%',
            p: 3,
            overflowY: 'auto',
            boxShadow: '0 16px 48px rgba(33, 26, 27, 0.18)',
          }}
        >
          <DetailBody item={item} />
        </Card>
      </Box>
    </Dialog>
  );
}
