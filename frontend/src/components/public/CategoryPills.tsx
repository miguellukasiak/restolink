import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scroller } from 'react-scroll';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import type { PublicMenuCategory } from '../../types';

/**
 * Scroll offset compensating for the sticky header, which the compact layout
 * measures at 97px (search row + chip bar). Landing the heading ~8px under it
 * keeps the category title visible instead of hidden behind the bar — the old
 * -180 was tuned for the taller icon-based navigation and now overshot.
 */
const SCROLL_OFFSET = -105;

interface CategoryPillsProps {
  categories: PublicMenuCategory[];
}

/**
 * Category navigation as compact Material filter chips on one horizontally
 * scrolling line — the pattern every delivery app uses, because it keeps the
 * whole category list one thumb-swipe away without eating vertical space.
 *
 * The chips replaced a row of 56px circular icons stacked over labels, which
 * cost roughly 90px of height before a guest saw a single dish.
 *
 * The bar lives inside the page's sticky header, so it stays reachable while
 * scrolling. The scrollbar is hidden on every engine (Firefox, WebKit/Blink,
 * old Edge) but the row stays scrollable by touch, wheel and keyboard.
 */
export function CategoryPills({ categories }: CategoryPillsProps) {
  const { t } = useTranslation();
  // Purely presentational: marks the chip the guest last jumped to, which is
  // what makes these read as *filter* chips rather than anonymous buttons.
  const [activeId, setActiveId] = useState<string | null>(null);

  const scrollTo = (categoryId: string) => {
    setActiveId(categoryId);
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
        gap: 0.75,
        overflowX: 'auto',
        pb: 1,
        // Keeps the first and last chip from sitting flush against the edge
        // while still allowing them to scroll fully into view.
        px: 0.25,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {categories.map((category) => {
        const selected = activeId === category.id;
        return (
          <Chip
            key={category.id}
            label={category.name}
            onClick={() => scrollTo(category.id)}
            aria-label={t('goToCategory', { name: category.name })}
            size="small"
            sx={{
              flexShrink: 0,
              // A string, not the sx multiplier: `borderRadius: 999` would
              // resolve to 999 × theme.shape.borderRadius.
              borderRadius: '999px',
              height: 32,
              fontSize: 13,
              fontWeight: 600,
              px: 0.5,
              // Both states derive from the themed palette, so they keep
              // working on a dark restaurant background.
              bgcolor: (theme) =>
                selected
                  ? theme.palette.primary.main
                  : alpha(theme.palette.text.primary, 0.06),
              color: (theme) =>
                selected
                  ? theme.palette.primary.contrastText
                  : theme.palette.text.primary,
              '&:hover': {
                bgcolor: (theme) =>
                  selected
                    ? theme.palette.primary.dark
                    : alpha(theme.palette.text.primary, 0.12),
              },
            }}
          />
        );
      })}
    </Box>
  );
}
