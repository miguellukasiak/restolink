import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { scroller } from 'react-scroll';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import RamenDiningRoundedIcon from '@mui/icons-material/RamenDiningRounded';
import DinnerDiningRoundedIcon from '@mui/icons-material/DinnerDiningRounded';
import TapasRoundedIcon from '@mui/icons-material/TapasRounded';
import CakeRoundedIcon from '@mui/icons-material/CakeRounded';
import LocalBarRoundedIcon from '@mui/icons-material/LocalBarRounded';
import CoffeeRoundedIcon from '@mui/icons-material/CoffeeRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import type { PublicMenuCategory } from '../../types';

/** Scroll offset compensating for the sticky header + pill bar. */
const SCROLL_OFFSET = -180;

/** Heuristic icon per category name — until categories carry their own icons. */
function categoryIcon(name: string): ReactElement {
  const lower = name.toLowerCase();
  if (lower.includes('zup')) return <RamenDiningRoundedIcon fontSize="small" />;
  if (lower.includes('główn')) return <DinnerDiningRoundedIcon fontSize="small" />;
  if (lower.includes('przystaw')) return <TapasRoundedIcon fontSize="small" />;
  if (lower.includes('deser') || lower.includes('słod'))
    return <CakeRoundedIcon fontSize="small" />;
  if (lower.includes('napo') || lower.includes('piwo') || lower.includes('wino'))
    return <LocalBarRoundedIcon fontSize="small" />;
  if (lower.includes('kaw')) return <CoffeeRoundedIcon fontSize="small" />;
  return <RestaurantRoundedIcon fontSize="small" />;
}

interface CategoryPillsProps {
  categories: PublicMenuCategory[];
}

/**
 * Horizontally scrollable category navigation: circular icon above the label,
 * smooth-scrolls to the matching section on click.
 */
export function CategoryPills({ categories }: CategoryPillsProps) {
  const { t } = useTranslation();

  const scrollTo = (categoryId: string) => {
    scroller.scrollTo(categoryId, {
      smooth: true,
      duration: 400,
      offset: SCROLL_OFFSET,
    });
  };

  return (
    <Box
      component="nav"
      aria-label={t('categoriesNav')}
      sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        px: 0.5,
        py: 1,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {categories.map((category) => (
        <ButtonBase
          key={category.id}
          onClick={() => scrollTo(category.id)}
          aria-label={t('goToCategory', { name: category.name })}
          sx={{ borderRadius: 4, flexShrink: 0, flexDirection: 'column', p: 0.75 }}
        >
          <Avatar
            sx={{
              width: 56,
              height: 56,
              mb: 0.5,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              color: 'primary.main',
            }}
          >
            {categoryIcon(category.name)}
          </Avatar>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {category.name}
          </Typography>
        </ButtonBase>
      ))}
    </Box>
  );
}
