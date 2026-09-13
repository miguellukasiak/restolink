import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { LanguageSwitcher } from './LanguageSwitcher';
import { revealHeaderSx } from './reveal';

interface MenuHeaderProps {
  restaurantName: string;
  logoUrl?: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  selectedAllergens: string[];
  canFilterAllergens: boolean;
  onOpenAllergyFilter?: () => void;
}

/**
 * The public menu's top bar.
 *
 * Search is a single icon until it is wanted, then takes the whole row. A
 * permanently expanded field was eating most of a phone header to serve the
 * minority of guests who search at all — everyone else paid for it in space
 * that could hold the brand and the controls. This is the pattern every
 * delivery app converged on for the same reason.
 */
export function MenuHeader({
  restaurantName,
  logoUrl,
  query,
  onQueryChange,
  selectedAllergens,
  canFilterAllergens,
  onOpenAllergyFilter,
}: MenuHeaderProps) {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on expand, so the keyboard is already up by the time the field
  // finishes appearing and the guest never taps twice to start typing.
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const collapse = () => {
    setSearchOpen(false);
    // Clearing is the point: leaving a filter applied behind a collapsed field
    // hides dishes with nothing on screen explaining why.
    onQueryChange('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') collapse();
  };

  const initials = restaurantName
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (searchOpen) {
    return (
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'center', py: 1 }}
        onKeyDown={handleKeyDown}
      >
        <IconButton
          onClick={collapse}
          aria-label={t('closeSearch')}
          sx={{ flexShrink: 0, color: 'text.secondary' }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>
        <TextField
          inputRef={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
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
              borderRadius: '999px',
              bgcolor: (theme) => alpha(theme.palette.text.primary, 0.045),
            },
          }}
        />
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: 'center', py: 1, ...revealHeaderSx }}
    >
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
          flexShrink: 0,
          border: '2px solid',
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
        }}
      >
        {initials || '·'}
      </Avatar>

      {/* Pushes the controls to the far edge, and is where the expanded field
          will unfold from. */}
      <Stack sx={{ flexGrow: 1, minWidth: 0 }} />

      <Tooltip title={t('openSearch')} arrow>
        <IconButton
          onClick={() => setSearchOpen(true)}
          aria-label={t('openSearch')}
          aria-expanded={false}
          sx={{ flexShrink: 0, color: 'text.secondary' }}
        >
          <SearchRoundedIcon />
        </IconButton>
      </Tooltip>

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
              color: selectedAllergens.length > 0 ? 'primary.main' : 'text.secondary',
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
  );
}
