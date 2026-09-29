import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { scroller } from 'react-scroll';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import type { PublicMenuCategory } from '../../types';

/**
 * Scroll offset compensating for the sticky header, which the compact layout
 * measures at roughly 92px (search row + chip bar). Landing the heading just
 * under it keeps the category title visible instead of hidden behind the bar.
 */
const SCROLL_OFFSET = -100;

interface CategoryPillsProps {
  categories: PublicMenuCategory[];
  /** The category the guest is currently reading, from the scroll spy. */
  activeId: string | null;
  /** Called before scrolling, so the spy can stand down during the animation. */
  onSelect: (categoryId: string) => void;
}

/**
 * Category navigation as compact Material filter chips on one horizontally
 * scrolling line — the pattern every delivery app uses, because it keeps the
 * whole category list one thumb-swipe away without eating vertical space.
 *
 * The active chip is driven by scroll position rather than by taps alone, and
 * follows the guest: scrolling into "Desserts" both highlights that chip and
 * slides it into view, so the bar always shows where they are even when that
 * category sits far enough along to have been scrolled off the strip.
 *
 * The scrollbar is hidden on every engine while the row stays scrollable by
 * touch, wheel and keyboard.
 */
export function CategoryPills({ categories, activeId, onSelect }: CategoryPillsProps) {
  const { t } = useTranslation();
  const chipRefs = useRef(new Map<string, HTMLElement>());
  const stripRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!activeId) return;
    const chip = chipRefs.current.get(activeId);
    const strip = stripRef.current;
    if (!chip || !strip) return;

    // Scrolls the strip itself, never `scrollIntoView`: that also scrolls
    // every ancestor, so a menu shown below the fold — the panel's live
    // previews on a phone — dragged the owner's whole page down to it, and
    // each category the spy then passed dragged it further.
    const stripBox = strip.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    // Rects are in screen pixels; a scaled-down preview needs layout pixels.
    const scale = stripBox.width / strip.offsetWidth || 1;
    const offset =
      (chipBox.left - stripBox.left - (stripBox.width - chipBox.width) / 2) / scale;
    strip.scrollTo({ left: strip.scrollLeft + offset, behavior: 'smooth' });
  }, [activeId]);

  const scrollTo = (categoryId: string) => {
    onSelect(categoryId);
    scroller.scrollTo(categoryId, {
      smooth: true,
      duration: 400,
      offset: SCROLL_OFFSET,
    });
  };

  return (
    <Box
      ref={stripRef}
      component="nav"
      aria-label={t('categoriesNav')}
      sx={{
        display: 'flex',
        gap: 0.75,
        overflowX: 'auto',
        pb: 1,
        // Keeps the first and last chip off the edge while still allowing them
        // to scroll fully into view.
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
            ref={(node: HTMLDivElement | null) => {
              if (node) chipRefs.current.set(category.id, node);
              else chipRefs.current.delete(category.id);
            }}
            label={category.name}
            onClick={() => scrollTo(category.id)}
            aria-label={t('goToCategory', { name: category.name })}
            aria-current={selected ? 'true' : undefined}
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
              transition: 'background-color 0.2s ease, color 0.2s ease',
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
