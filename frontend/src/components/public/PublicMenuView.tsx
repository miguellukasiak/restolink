import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Element as ScrollElement } from 'react-scroll';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import type { PublicMenuCategory, PublicMenuItem } from '../../types';
import { CategoryPills } from './CategoryPills';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PublicItemCard } from './PublicItemCard';

/** Stable empty default so the filter memo isn't invalidated every render. */
const NO_ALLERGENS: string[] = [];

interface PublicMenuViewProps {
  restaurantName: string;
  logoUrl?: string | null;
  categories: PublicMenuCategory[];
  /** Omit to render a read-only variant (settings live preview). */
  onOpenItem?: (item: PublicMenuItem) => void;
  /** Allergens the guest wants excluded — dishes containing any are hidden. */
  selectedAllergens?: string[];
  /** Show the header allergy-filter button (only when the menu has allergens). */
  canFilterAllergens?: boolean;
  /** Open the allergy filter sheet (omit to hide the header button). */
  onOpenAllergyFilter?: () => void;
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
  onOpenItem,
  selectedAllergens = NO_ALLERGENS,
  canFilterAllergens = false,
  onOpenAllergyFilter,
}: PublicMenuViewProps) {
  const { t } = useTranslation();
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

  const resultsCount = useMemo(
    () => filteredCategories.reduce((sum, category) => sum + category.items.length, 0),
    [filteredCategories],
  );

  const initials = restaurantName
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Box
      sx={{
        minHeight: '100%',
        bgcolor: 'background.default',
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
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 1 }}>
            <Avatar
              src={logoUrl ?? undefined}
              aria-label={t('restaurantLogo', { name: restaurantName })}
              sx={{
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
                fontWeight: 700,
                width: 36,
                height: 36,
                fontSize: 14,
                border: '2px solid',
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
              }}
            >
              {initials || '·'}
            </Avatar>
            <TextField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              size="small"
              fullWidth
              slotProps={{
                htmlInput: { 'aria-label': t('searchAria'), type: 'search' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.045),
                },
              }}
            />
            {canFilterAllergens && onOpenAllergyFilter && (
              <Tooltip title={t('allergyFilter')} arrow>
                <IconButton
                  onClick={onOpenAllergyFilter}
                  aria-label={
                    selectedAllergens.length > 0
                      ? t('allergyFilterActive', { count: selectedAllergens.length })
                      : t('allergyFilter')
                  }
                  sx={{
                    flexShrink: 0,
                    color:
                      selectedAllergens.length > 0 ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <Badge
                    badgeContent={selectedAllergens.length}
                    color="primary"
                    overlap="circular"
                  >
                    <HealthAndSafetyRoundedIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <LanguageSwitcher />
          </Stack>

          {filteredCategories.length > 0 && (
            <CategoryPills categories={filteredCategories} />
          )}
        </Box>
      </Box>

      {/* Live region: announces how many dishes match the search. */}
      <Box aria-live="polite" sx={visuallyHidden}>
        {query.trim() ? t('resultsFound', { count: resultsCount }) : ''}
      </Box>

      <Box component="main" sx={{ maxWidth: 1200, mx: 'auto', px: 1.5, pb: 6 }}>
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
          <Stack spacing={2} sx={{ mt: 5, alignItems: 'center', color: 'text.secondary' }}>
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

        {filteredCategories.map((category) => (
          <ScrollElement name={category.id} key={category.id}>
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
                  fontSize: { xs: 17, sm: 20 },
                  fontWeight: 700,
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
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(3, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                  },
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
        ))}
      </Box>
    </Box>
  );
}
