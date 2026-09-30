import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Element as ScrollElement } from 'react-scroll';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import type { MenuNote, PublicMenuCategory, PublicMenuItem } from '../../types';
import { useCategoryScrollSpy } from '../../hooks/useCategoryScrollSpy';
import { CategoryPills } from './CategoryPills';
import { MenuHeader } from './MenuHeader';
import { PublicItemCard } from './PublicItemCard';
import { MenuNoteCard } from './MenuNoteCard';
import { menuSections } from '../../utils/menuLayout';

/** Stable empty default so the filter memo isn't invalidated every render. */
const NO_ALLERGENS: string[] = [];
const NO_LANGUAGES: readonly string[] = [];
const NO_NOTES: MenuNote[] = [];

/*
 * Container queries against `<main>`'s content box, which is the viewport
 * minus 24px of padding and at most 1176px. The thresholds sit where the old
 * viewport breakpoints (sm 600, lg 1200) put them for a guest on a real
 * device, so the live menu lays out as before.
 */
const WIDE = '@container (min-width: 576px)';
const WIDEST = '@container (min-width: 1176px)';

interface PublicMenuViewProps {
  restaurantName: string;
  logoUrl?: string | null;
  categories: PublicMenuCategory[];
  /** The owner's notes, placed among the categories by `order`. */
  notes?: MenuNote[];
  /** Omit to render a read-only variant (settings live preview). */
  onOpenItem?: (item: PublicMenuItem) => void;
  /** Allergens the guest wants excluded — dishes containing any are hidden. */
  selectedAllergens?: string[];
  /** Show the header allergy-filter button (only when the menu has allergens). */
  canFilterAllergens?: boolean;
  /** Open the allergy filter sheet (omit to hide the header button). */
  onOpenAllergyFilter?: () => void;
  /** Languages the restaurant offers, its own first. One or none hides the switcher. */
  languages?: readonly string[];
  /** Shown where the dishes go when the menu has no categories yet — the
   *  panel's previews pass one; the guest page does not. */
  emptyState?: ReactNode;
}

/**
 * Presentational public menu: sticky header (logo, search, language toggle),
 * category pills, and dish sections. Used natively by PublicMenuPage and,
 * scaled down, inside the settings-page device preview.
 */
export function PublicMenuView({
  restaurantName,
  logoUrl,
  categories,
  notes = NO_NOTES,
  onOpenItem,
  selectedAllergens = NO_ALLERGENS,
  canFilterAllergens = false,
  languages = NO_LANGUAGES,
  onOpenAllergyFilter,
  emptyState,
}: PublicMenuViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const filteredCategories = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const hasAllergyFilter = selectedAllergens.length > 0;
    if (!trimmed && !hasAllergyFilter) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          // Exclusion: hide any dish containing a selected allergen.
          if (
            hasAllergyFilter &&
            item.allergens.some((allergen) => selectedAllergens.includes(allergen))
          ) {
            return false;
          }
          if (
            trimmed &&
            ![item.name, item.description, item.ingredients]
              .join(' ')
              .toLowerCase()
              .includes(trimmed)
          ) {
            return false;
          }
          return true;
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, query, selectedAllergens]);

  // Ids in menu order — the spy needs to know which section is 'above'
  // which when two share the observation band.
  const categoryIds = useMemo(
    () => filteredCategories.map((category) => category.id),
    [filteredCategories],
  );
  const { activeId: activeCategoryId, selectCategory } =
    useCategoryScrollSpy(categoryIds);

  // A search is a hunt for a dish, so the notes step aside while it runs.
  // The allergy filter is not: a guest browses with it on all visit long.
  const searching = query.trim() !== '';
  const sections = useMemo(
    () => menuSections(filteredCategories, searching ? NO_NOTES : notes),
    [filteredCategories, notes, searching],
  );

  const resultsCount = useMemo(
    () => filteredCategories.reduce((sum, category) => sum + category.items.length, 0),
    [filteredCategories],
  );

  return (
    <Box
      sx={{
        minHeight: '100%',
        bgcolor: 'background.default',
        // The theme's background pattern, if it has one (see menuPatterns).
        ...(theme.menuDecor?.pattern ?? {}),
        // Anchor inherited text to the themed on-background color so headings
        // (and any Typography without an explicit color) stay readable when the
        // background is dark — otherwise they'd inherit the outer page's color.
        color: 'text.primary',
      }}
    >
      {/* Sticky top bar: logo, search, language toggle */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          bgcolor: (theme) => alpha(theme.palette.background.default, 0.92),
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: 1.5 }}>
          <MenuHeader
            restaurantName={restaurantName}
            logoUrl={logoUrl}
            query={query}
            onQueryChange={setQuery}
            selectedAllergens={selectedAllergens}
            canFilterAllergens={canFilterAllergens}
            onOpenAllergyFilter={onOpenAllergyFilter}
            languages={languages}
          />

          {filteredCategories.length > 0 && (
            <CategoryPills
              categories={filteredCategories}
              activeId={activeCategoryId}
              onSelect={selectCategory}
            />
          )}
        </Box>
      </Box>

      {/* Live region: announces how many dishes match the search. */}
      <Box aria-live="polite" sx={visuallyHidden}>
        {query.trim() ? t('resultsFound', { count: resultsCount }) : ''}
      </Box>

      {/* A size container: the dish grid below answers to the width it is
          given, not to the window's. On the live page those are the same
          thing; in the owner panel's previews the menu is laid out at a
          phone's width inside a desktop window, and viewport breakpoints
          gave the phone mockup a four-column desktop grid. */}
      <Box
        component="main"
        sx={{ maxWidth: 1200, mx: 'auto', px: 1.5, pb: 6, containerType: 'inline-size' }}
      >
        {query.trim() && resultsCount === 0 && (
          <Stack
            spacing={1.5}
            sx={{ mt: 5, alignItems: 'center', color: 'text.secondary' }}
          >
            <SearchOffRoundedIcon sx={{ fontSize: 44, opacity: 0.4 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('emptySearch', { query: query.trim() })}
            </Typography>
          </Stack>
        )}

        {/* Everything hidden purely by the allergy filter — offer a way back. */}
        {!query.trim() && resultsCount === 0 && selectedAllergens.length > 0 && (
          <Stack
            spacing={2}
            sx={{ mt: 5, alignItems: 'center', color: 'text.secondary' }}
          >
            <HealthAndSafetyRoundedIcon sx={{ fontSize: 44, opacity: 0.4 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, textAlign: 'center' }}>
              {t('noDishesForAllergens')}
            </Typography>
            {onOpenAllergyFilter && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<HealthAndSafetyRoundedIcon />}
                onClick={onOpenAllergyFilter}
              >
                {t('adjustFilters')}
              </Button>
            )}
          </Stack>
        )}

        {categories.length === 0 && emptyState}

        {sections.map((section) =>
          section.kind === 'note' ? (
            <Box key={section.id} id={section.id} sx={{ pt: 2.5 }}>
              <MenuNoteCard body={section.note.body} style={section.note.style} />
            </Box>
          ) : (
            <CategorySection
              key={section.id}
              category={section.category}
              onOpenItem={onOpenItem}
            />
          ),
        )}
      </Box>
    </Box>
  );
}

function CategorySection({
  category,
  onOpenItem,
}: {
  category: PublicMenuCategory;
  onOpenItem?: (item: PublicMenuItem) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollElement name={category.id} id={category.id}>
      <Box
        component="section"
        aria-labelledby={`category-heading-${category.id}`}
        sx={{ pt: 2.5 }}
      >
        <Typography
          component="h2"
          id={`category-heading-${category.id}`}
          sx={{
            // Was `variant="h5"` in the heading serif — handsome, but it
            // ate close to 40px per category on a phone. Kept clearly
            // dominant over the 14px dish names without the bulk.
            fontSize: 17 * (theme.menuDecor?.headingScale ?? 1),
            [WIDE]: { fontSize: 20 * (theme.menuDecor?.headingScale ?? 1) },
            // The theme's heading face: this is where a menu's
            // character shows, while dish names stay in the text face.
            fontFamily: theme.typography.h5.fontFamily,
            fontWeight: theme.typography.h5.fontWeight,
            letterSpacing: '-0.01em',
            mb: 1,
          }}
        >
          {category.name}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            // Fixed column counts rather than `auto-fill minmax()`: the
            // old rule could drop to a single column on a narrow phone,
            // which is exactly the low-density layout being replaced.
            // Two-up is guaranteed at every width.
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            [WIDE]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
            [WIDEST]: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
            alignItems: 'stretch',
          }}
        >
          {category.items.map((item) => (
            <PublicItemCard key={item.id} item={item} onOpen={onOpenItem} />
          ))}
        </Box>
      </Box>
    </ScrollElement>
  );
}
