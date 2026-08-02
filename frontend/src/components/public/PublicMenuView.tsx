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
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import type { PublicMenuCategory, PublicMenuItem } from '../../types';
import { CategoryPills } from './CategoryPills';
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
  const { t, i18n } = useTranslation();
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

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language.startsWith('pl') ? 'en' : 'pl');
  };

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
        <Box sx={{ maxWidth: 960, mx: 'auto', px: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1.5 }}>
            <Avatar
              src={logoUrl ?? undefined}
              aria-label={t('restaurantLogo', { name: restaurantName })}
              sx={{
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
                fontWeight: 700,
                width: 48,
                height: 48,
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
              <Tooltip title="Filtruj alergeny" arrow>
                <IconButton
                  onClick={onOpenAllergyFilter}
                  aria-label={
                    selectedAllergens.length > 0
                      ? `Filtruj alergeny (aktywne wykluczenia: ${selectedAllergens.length})`
                      : 'Filtruj alergeny'
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
            <Button
              onClick={toggleLanguage}
              aria-label={t('languageToggle')}
              startIcon={<LanguageRoundedIcon />}
              color="inherit"
              sx={{ flexShrink: 0, fontWeight: 700, minWidth: 0 }}
            >
              {i18n.language.startsWith('pl') ? 'PL' : 'EN'}
            </Button>
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

      <Box component="main" sx={{ maxWidth: 960, mx: 'auto', px: 2, pb: 8 }}>
        {query.trim() && resultsCount === 0 && (
          <Stack
            spacing={1.5}
            sx={{ mt: 8, alignItems: 'center', color: 'text.secondary' }}
          >
            <SearchOffRoundedIcon sx={{ fontSize: 52, opacity: 0.4 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('emptySearch', { query: query.trim() })}
            </Typography>
          </Stack>
        )}

        {/* Everything hidden purely by the allergy filter — offer a way back. */}
        {!query.trim() && resultsCount === 0 && selectedAllergens.length > 0 && (
          <Stack spacing={2} sx={{ mt: 8, alignItems: 'center', color: 'text.secondary' }}>
            <HealthAndSafetyRoundedIcon sx={{ fontSize: 52, opacity: 0.4 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, textAlign: 'center' }}>
              Żadne danie nie spełnia Twoich filtrów alergenów.
            </Typography>
            {onOpenAllergyFilter && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<HealthAndSafetyRoundedIcon />}
                onClick={onOpenAllergyFilter}
              >
                Dostosuj filtry
              </Button>
            )}
          </Stack>
        )}

        {filteredCategories.map((category) => (
          <ScrollElement name={category.id} key={category.id}>
            <Box
              component="section"
              aria-labelledby={`category-heading-${category.id}`}
              sx={{ pt: 4 }}
            >
              <Typography
                variant="h5"
                component="h2"
                id={`category-heading-${category.id}`}
                gutterBottom
              >
                {category.name}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 2,
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
