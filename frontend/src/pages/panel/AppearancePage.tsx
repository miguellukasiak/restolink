import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ThemeProvider, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SmartphoneRoundedIcon from '@mui/icons-material/SmartphoneRounded';
import DesktopWindowsRoundedIcon from '@mui/icons-material/DesktopWindowsRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ColorizeRoundedIcon from '@mui/icons-material/ColorizeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import {
  FONT_PAIRINGS,
  MENU_THEMES,
  VENUES,
  fontStack,
  type MenuTheme,
  type VenueKind,
} from '../../constants/menuStyle';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { useUpdateTheme } from '../../hooks/useUpdateTheme';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { radii } from '../../theme';
import { createRestaurantTheme } from '../../components/public/RestaurantThemeProvider';
import { MENU_PATTERNS, patternCss } from '../../components/public/menuPatterns';
import { PublicMenuView } from '../../components/public/PublicMenuView';
import { MenuSkeleton } from '../../components/public/MenuSkeleton';
import { PhoneFrame } from '../../components/panel/PhoneFrame';
import { EmptyMenuPreview } from '../../components/panel/EmptyMenuPreview';
import { UnsavedChangesGuard } from '../../components/panel/UnsavedChangesGuard';
import { ThemeThumb, type ThumbDish } from '../../components/panel/ThemeThumb';
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight';
import { useFittedPhone } from '../../hooks/useFittedPhone';
import { GuestPreviewLanguage } from '../../components/panel/GuestPreviewLanguage';
import { usePanelT } from '../../i18n/panel';

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** The desktop preview is laid out at this width and scaled into the column. */
const DESKTOP_WIDTH = 1024;
/** The preview column less the frame's 1px borders. */
const DESKTOP_SCALE = 358 / DESKTOP_WIDTH;

interface ThemeFormValues {
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  font_family: string;
  menu_pattern: string | null;
}

/** Guards live-preview values: mid-typing hex like "#8C1" must not reach createTheme. */
const safeHex = (value: string | undefined, fallback: string) =>
  value && HEX_PATTERN.test(value) ? value : fallback;

/**
 * Swatches offered for each colour: a spread taken from the themes, one per
 * hue family, so a single row covers most of what an owner reaches for.
 */
const PRIMARY_SWATCHES = [
  '#1C1B1F',
  '#B8322A',
  '#E4572E',
  '#E3A42B',
  '#2E7D32',
  '#0E7C86',
  '#1F5FAD',
  '#D6336C',
];
const BACKGROUND_SWATCHES = [
  '#FFFFFF',
  '#FBF3E4',
  '#F4F1EC',
  '#F2F7EE',
  '#FFF0F5',
  '#FFD23F',
  '#2A1E17',
  '#141A33',
];

/** The dishes the thumbnails show when the menu has none yet; named by
 *  `appearance.sample.<key>`. */
const SAMPLE_DISHES = [
  { key: 'dish1', price: 29 },
  { key: 'dish2', price: 22 },
  { key: 'dish3', price: 39 },
  { key: 'dish4', price: 18 },
];

const sameColor = (a?: string | null, b?: string | null) =>
  (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

function matchesTheme(theme: MenuTheme, values: Partial<ThemeFormValues>) {
  return (
    sameColor(theme.primary_color, values.primary_color) &&
    sameColor(theme.background_color, values.background_color) &&
    theme.font_family === values.font_family &&
    (theme.menu_pattern ?? null) === (values.menu_pattern ?? null)
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper elevation={1} sx={{ borderRadius: radii.lg, p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          {hint && (
            <Typography variant="body2" color="text.secondary">
              {hint}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

/** A choice tile: selected state drawn the same way everywhere on the page. */
function ChoiceTile({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0.75,
        p: 0.75,
        borderRadius: radii.md,
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'transparent',
        bgcolor: (t) => alpha(t.palette.primary.main, selected ? 0.08 : 0),
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': {
          bgcolor: (t) => alpha(t.palette.primary.main, selected ? 0.1 : 0.05),
        },
      }}
    >
      {children}
      <Typography
        variant="caption"
        noWrap
        sx={{
          fontWeight: selected ? 700 : 600,
          color: selected ? 'primary.dark' : 'text.primary',
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: readonly string[];
  error?: string;
}

/** Preset swatches + hex input + native colour picker for one colour setting. */
function ColorField({ label, value, onChange, presets, error }: ColorFieldProps) {
  const { t } = usePanelT();
  const nativeInputRef = useRef<HTMLInputElement>(null);
  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', mb: 1.5 }}>
        {presets.map((preset) => {
          const selected = sameColor(value, preset);
          return (
            <ButtonBase
              key={preset}
              onClick={() => onChange(preset)}
              aria-label={`${label}: ${preset}`}
              aria-pressed={selected}
              sx={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                bgcolor: preset,
                boxShadow: (t) =>
                  selected
                    ? `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${t.palette.primary.main}`
                    : `inset 0 0 0 1px ${alpha('#000', 0.14)}`,
              }}
            />
          );
        })}
      </Stack>
      <TextField
        size="small"
        fullWidth
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={Boolean(error)}
        helperText={error ?? ' '}
        slotProps={{
          htmlInput: { 'aria-label': `${label} (HEX)` },
          input: {
            startAdornment: (
              <Box
                aria-hidden
                sx={{
                  width: 20,
                  height: 20,
                  mr: 1,
                  borderRadius: '6px',
                  bgcolor: HEX_PATTERN.test(value) ? value : 'divider',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            ),
            endAdornment: (
              <Tooltip title={t('appearance.pickPalette')} arrow>
                <IconButton
                  size="small"
                  aria-label={t('appearance.pickPaletteAria', { label })}
                  onClick={() => nativeInputRef.current?.click()}
                >
                  <ColorizeRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ),
          },
        }}
      />
      <input
        ref={nativeInputRef}
        type="color"
        value={HEX_PATTERN.test(value) ? value : '#000000'}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        aria-label={t('appearance.paletteAria', { label })}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}

/**
 * "Wygląd menu" — pick a look the way you pick a video-call background.
 *
 * The page opens on a gallery of themes, each shown as a thumbnail of the
 * restaurant's *own* menu (its first dishes and photos) in that look; one tap
 * tries it on the full-size preview. The individual settings — logo, colours,
 * typeface, background pattern — sit underneath for anyone who wants to
 * adjust a theme rather than build one from scratch. Nothing is saved until
 * "Zapisz zmiany".
 */
export function AppearancePage() {
  const { t } = usePanelT();
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();
  const menu = usePublicMenu(restaurantId);
  const updateTheme = useUpdateTheme(restaurantId);

  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [venue, setVenue] = useState<VenueKind | 'all'>('all');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);

  // The desktop preview lays the menu out at 1024px and scales it down; see
  // useMeasuredHeight for why its wrapper is sized from a measurement. (The
  // phone preview does the same inside PhoneFrame.)
  const desktopContent = useMeasuredHeight(`${device}-${menu.isLoading}`);
  // The preview column starts level with the page title. Around the phone: the
  // app bar and page padding (96px), the device toggle and its gap (~54px) and
  // a little air below.
  const phone = useFittedPhone({ reserveY: 170 });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty, errors },
  } = useForm<ThemeFormValues>({
    mode: 'onChange',
    defaultValues: {
      logo_url: null,
      primary_color: '#8C1D18',
      background_color: '#FCF4F6',
      font_family: 'Roboto',
      menu_pattern: null,
    },
  });

  // Hydrate the form once from the saved theme.
  useEffect(() => {
    if (menu.data && !hydratedRef.current) {
      hydratedRef.current = true;
      const saved = menu.data.restaurant.theme;
      reset({ ...saved, menu_pattern: saved.menu_pattern ?? null });
    }
  }, [menu.data, reset]);

  const watched = useWatch({ control });
  const primary = safeHex(watched.primary_color, '#8C1D18');
  const background = safeHex(watched.background_color, '#FCF4F6');

  const previewTheme = useMemo(
    () =>
      createRestaurantTheme({
        primary_color: primary,
        background_color: background,
        font_family: watched.font_family,
        menu_pattern: watched.menu_pattern ?? null,
      }),
    [primary, background, watched.font_family, watched.menu_pattern],
  );

  // The thumbnails show the restaurant's own dishes, photographed ones first.
  const { thumbCategory, thumbDishes } = useMemo(() => {
    const categories = menu.data?.categories ?? [];
    const dishes = categories.flatMap((category) => category.items);
    const withPhotos = dishes.filter((dish) => dish.image_url);
    const chosen = [...withPhotos, ...dishes.filter((dish) => !dish.image_url)].slice(
      0,
      4,
    );
    return {
      thumbCategory:
        categories.find((category) => category.items.length > 0)?.name ??
        t('appearance.sample.category'),
      thumbDishes:
        chosen.length > 0
          ? chosen
          : SAMPLE_DISHES.map(
              ({ key, price }): ThumbDish => ({
                name: t(`appearance.sample.${key}`),
                price,
                image_url: null,
              }),
            ),
    };
  }, [menu.data, t]);

  const visibleThemes =
    venue === 'all'
      ? MENU_THEMES
      : MENU_THEMES.filter((theme) => theme.venues.includes(venue));
  const activeTheme = MENU_THEMES.find((theme) => matchesTheme(theme, watched));

  const applyTheme = (theme: MenuTheme) => {
    const options = { shouldDirty: true, shouldValidate: true };
    setValue('primary_color', theme.primary_color, options);
    setValue('background_color', theme.background_color, options);
    setValue('font_family', theme.font_family, options);
    setValue('menu_pattern', theme.menu_pattern, options);
  };

  const surpriseMe = () => {
    const pool = visibleThemes.filter((theme) => theme.id !== activeTheme?.id);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) applyTheme(pick);
  };

  const handleLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setValue('logo_url', String(reader.result), { shouldDirty: true });
    reader.readAsDataURL(file);
  };

  const onSubmit = handleSubmit((values) => {
    updateTheme.mutate(values, {
      onSuccess: () => {
        showSuccess(t('appearance.saved'));
        reset(values);
      },
      onError: (error) => showError(getApiErrorMessage(error)),
    });
  });

  /** "Save and continue" in the leave dialog: true once the look is saved. */
  const saveBeforeLeaving = async () => {
    let saved = false;
    await handleSubmit(async (values) => {
      try {
        await updateTheme.mutateAsync(values);
        reset(values);
        showSuccess(t('appearance.saved'));
        saved = true;
      } catch (error) {
        showError(getApiErrorMessage(error));
      }
    })();
    return saved;
  };

  const isSaving = updateTheme.isPending;

  // Same rich, page-shaped skeleton used on the live public menu — shown until
  // the first fetch resolves (React Query keeps `data` truthy afterwards, so
  // saves/refetches never flash back to this state).
  const preview =
    menu.isLoading || !menu.data ? (
      <MenuSkeleton />
    ) : (
      <GuestPreviewLanguage>
        <ThemeProvider theme={previewTheme}>
          <Box
            sx={{
              pointerEvents: 'none',
              bgcolor: 'background.default',
              // Stretched to the screen by the frame around it, so an empty
              // or short menu still fills it in its own colours.
              display: 'flex',
              flexDirection: 'column',
              '& > *': { flexGrow: 1 },
            }}
          >
            <PublicMenuView
              restaurantName={menu.data.restaurant.name}
              logoUrl={watched.logo_url}
              languages={menu.data.restaurant.languages}
              categories={menu.data.categories}
              notes={menu.data.notes}
              emptyState={<EmptyMenuPreview hint={t('preview.emptyMenuHint')} />}
            />
          </Box>
        </ThemeProvider>
      </GuestPreviewLanguage>
    );

  return (
    <Box sx={{ maxWidth: 1360, mx: 'auto', pt: 4 }}>
      <UnsavedChangesGuard when={isDirty} onSave={saveBeforeLeaving} />
      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' },
          gap: 4,
          alignItems: 'start',
        }}
      >
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          {/* The heading sits in this column so the preview beside it can
              start at the top of the page and have the height it needs. */}
          <Stack spacing={0.5}>
            <Typography variant="h4" component="h1">
              {t('nav.appearance')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('appearance.intro')}
            </Typography>
          </Stack>

          <Section
            title={t('appearance.themes')}
            hint={t('appearance.themesHint')}
            action={
              <Button
                onClick={surpriseMe}
                startIcon={<CasinoRoundedIcon />}
                sx={{ flexShrink: 0 }}
              >
                {t('appearance.surprise')}
              </Button>
            }
          >
            <Stack
              direction="row"
              useFlexGap
              spacing={0.75}
              sx={{ flexWrap: 'wrap', mb: 2 }}
            >
              {(['all', ...VENUES] as const).map((option) => (
                <Chip
                  size="small"
                  key={option}
                  label={t(`appearance.venue.${option}`)}
                  clickable
                  onClick={() => setVenue(option)}
                  variant={venue === option ? 'filled' : 'outlined'}
                  color={venue === option ? 'primary' : 'default'}
                  aria-pressed={venue === option}
                />
              ))}
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 1.5,
              }}
            >
              {visibleThemes.map((theme) => {
                const selected = activeTheme?.id === theme.id;
                const name = t(`appearance.theme.${theme.id}.name`);
                const vibe = t(`appearance.theme.${theme.id}.vibe`);
                return (
                  <ButtonBase
                    key={theme.id}
                    onClick={() => applyTheme(theme)}
                    aria-pressed={selected}
                    aria-label={t('appearance.themeAria', { name, vibe })}
                    sx={{
                      position: 'relative',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      textAlign: 'left',
                      p: 0.75,
                      borderRadius: radii.md,
                      border: '2px solid',
                      borderColor: selected ? 'primary.main' : 'transparent',
                      bgcolor: (t) => alpha(t.palette.primary.main, selected ? 0.08 : 0),
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      '&:hover': {
                        bgcolor: (t) =>
                          alpha(t.palette.primary.main, selected ? 0.1 : 0.05),
                      },
                      '&:hover .theme-thumb': { transform: 'translateY(-2px)' },
                    }}
                  >
                    <Box
                      className="theme-thumb"
                      sx={{
                        aspectRatio: '3 / 4',
                        borderRadius: radii.sm,
                        overflow: 'hidden',
                        boxShadow: `0 6px 18px ${alpha('#161C25', 0.14)}, inset 0 0 0 1px ${alpha('#161C25', 0.06)}`,
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <ThemeThumb
                        theme={theme}
                        categoryName={thumbCategory}
                        dishes={thumbDishes}
                        logoUrl={watched.logo_url}
                      />
                    </Box>
                    <Box sx={{ px: 0.5, pt: 1, pb: 0.25, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        noWrap
                        sx={{ color: selected ? 'primary.dark' : 'text.primary' }}
                      >
                        {name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="p"
                        sx={{
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow: 'hidden',
                        }}
                      >
                        {vibe}
                      </Typography>
                    </Box>
                    {selected && (
                      <CheckCircleRoundedIcon
                        color="primary"
                        sx={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          bgcolor: 'background.paper',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </ButtonBase>
                );
              })}
            </Box>
          </Section>

          <Section
            title={t('appearance.details')}
            hint={
              activeTheme
                ? t('appearance.detailsChosen', {
                    name: t(`appearance.theme.${activeTheme.id}.name`),
                  })
                : t('appearance.detailsOwn')
            }
          >
            <Stack spacing={3.5}>
              {/* Logo */}
              <Controller
                name="logo_url"
                control={control}
                render={({ field }) => (
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Avatar
                      src={field.value ?? undefined}
                      variant="rounded"
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: radii.md,
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                        color: 'primary.main',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <AddPhotoAlternateRoundedIcon />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" component="h3">
                        {t('appearance.logo')}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="p"
                        sx={{ display: { xs: 'none', sm: 'block' } }}
                      >
                        {t('appearance.logoHint')}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {field.value ? t('appearance.logoChange') : t('appearance.logoAdd')}
                    </Button>
                    {field.value && (
                      <Tooltip title={t('appearance.logoRemove')} arrow>
                        <IconButton
                          aria-label={t('appearance.logoRemove')}
                          onClick={() =>
                            setValue('logo_url', null, { shouldDirty: true })
                          }
                        >
                          <DeleteOutlineRoundedIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                )}
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={handleLogoFile}
              />

              {/* Colours */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 3,
                }}
              >
                <Controller
                  name="primary_color"
                  control={control}
                  rules={{
                    pattern: {
                      value: HEX_PATTERN,
                      message: t('appearance.hexError'),
                    },
                  }}
                  render={({ field }) => (
                    <ColorField
                      label={t('appearance.primary')}
                      value={field.value}
                      onChange={field.onChange}
                      presets={PRIMARY_SWATCHES}
                      error={errors.primary_color?.message}
                    />
                  )}
                />
                <Controller
                  name="background_color"
                  control={control}
                  rules={{
                    pattern: {
                      value: HEX_PATTERN,
                      message: t('appearance.hexError'),
                    },
                  }}
                  render={({ field }) => (
                    <ColorField
                      label={t('appearance.background')}
                      value={field.value}
                      onChange={field.onChange}
                      presets={BACKGROUND_SWATCHES}
                      error={errors.background_color?.message}
                    />
                  )}
                />
              </Box>

              {/* Typeface */}
              <Box>
                <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                  {t('appearance.typeface')}
                </Typography>
                <Controller
                  name="font_family"
                  control={control}
                  render={({ field }) => (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
                        gap: 1,
                      }}
                    >
                      {FONT_PAIRINGS.map((pairing) => (
                        <ChoiceTile
                          key={pairing.value}
                          label={t(`appearance.font.${pairing.id}`)}
                          selected={field.value === pairing.value}
                          onClick={() => field.onChange(pairing.value)}
                        >
                          <Box
                            sx={{
                              height: 64,
                              borderRadius: radii.sm,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: background,
                              color: previewTheme.palette.text.primary,
                              boxShadow: `inset 0 0 0 1px ${alpha('#161C25', 0.08)}`,
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                fontFamily: fontStack(pairing.heading.family),
                                fontWeight: pairing.heading.weight,
                                fontSize: 24 * (pairing.headingScale ?? 1),
                                lineHeight: 1.1,
                              }}
                            >
                              Aa
                            </Box>
                            <Box
                              component="span"
                              sx={{
                                fontFamily: fontStack(pairing.body.family),
                                fontSize: 9.5,
                                letterSpacing: '-0.01em',
                                opacity: 0.75,
                                // One line in every face, the wide ones too.
                                whiteSpace: 'nowrap',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {t('appearance.fontSample')}
                            </Box>
                          </Box>
                        </ChoiceTile>
                      ))}
                    </Box>
                  )}
                />
              </Box>

              {/* Pattern */}
              <Box>
                <Typography variant="subtitle2" component="h3">
                  {t('appearance.pattern.title')}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="p"
                  sx={{ mb: 1 }}
                >
                  {t('appearance.pattern.hint')}
                </Typography>
                <Controller
                  name="menu_pattern"
                  control={control}
                  render={({ field }) => (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
                        gap: 1,
                      }}
                    >
                      <ChoiceTile
                        label={t('appearance.pattern.none')}
                        selected={!field.value}
                        onClick={() => field.onChange(null)}
                      >
                        <Box
                          sx={{
                            height: 56,
                            borderRadius: radii.sm,
                            bgcolor: background,
                            boxShadow: `inset 0 0 0 1px ${alpha('#161C25', 0.08)}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: previewTheme.palette.text.secondary,
                          }}
                        >
                          <BlockRoundedIcon fontSize="small" />
                        </Box>
                      </ChoiceTile>
                      {MENU_PATTERNS.map((pattern) => (
                        <ChoiceTile
                          key={pattern.id}
                          label={t(`appearance.pattern.${pattern.id}`)}
                          selected={field.value === pattern.id}
                          onClick={() => field.onChange(pattern.id)}
                        >
                          <Box
                            sx={{
                              height: 56,
                              borderRadius: radii.sm,
                              bgcolor: background,
                              boxShadow: `inset 0 0 0 1px ${alpha('#161C25', 0.08)}`,
                              // Drawn at the stronger, dark-background
                              // opacity so the shape reads at this size.
                              ...(patternCss(pattern.id, primary, true) ?? {}),
                            }}
                          />
                        </ChoiceTile>
                      ))}
                    </Box>
                  )}
                />
              </Box>
            </Stack>
          </Section>

          {/* Sticky save bar */}
          <Box sx={{ position: 'sticky', bottom: 16, zIndex: 2 }}>
            <Paper
              elevation={4}
              sx={{
                borderRadius: radii.pill,
                pl: 3,
                pr: 1,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                bgcolor: 'background.paper',
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1, minWidth: 0 }}
                aria-live="polite"
              >
                {isDirty ? (
                  <>
                    {t('appearance.unsaved')}
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {' '}
                      {t('appearance.unsavedGuests')}
                    </Box>
                  </>
                ) : (
                  t('appearance.allSaved')
                )}
              </Typography>
              <Button
                type="submit"
                variant="contained"
                disabled={!isDirty || isSaving}
                startIcon={
                  isSaving ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SaveRoundedIcon />
                  )
                }
              >
                {isSaving ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </Paper>
          </Box>
        </Stack>

        {/* Live preview */}
        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <ToggleButtonGroup
              value={device}
              exclusive
              onChange={(_event, value: 'mobile' | 'desktop' | null) => {
                if (value) setDevice(value);
              }}
              size="small"
              aria-label={t('appearance.previewMode')}
            >
              <ToggleButton value="mobile" aria-label={t('appearance.previewPhone')}>
                <SmartphoneRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                {t('common.phone')}
              </ToggleButton>
              <ToggleButton value="desktop" aria-label={t('appearance.previewComputer')}>
                <DesktopWindowsRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                {t('common.computer')}
              </ToggleButton>
            </ToggleButtonGroup>

            {device === 'mobile' ? (
              <PhoneFrame
                address={`restolink.app/menu/${restaurantId.slice(0, 8)}…`}
                measureKey={menu.isLoading}
                width={phone.width}
                screenHeight={phone.screenHeight}
              >
                {preview}
              </PhoneFrame>
            ) : (
              <Box
                sx={{
                  width: '100%',
                  borderRadius: radii.lg,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 16px 48px rgba(28, 27, 34, 0.16)',
                  overflow: 'hidden',
                  bgcolor: '#FFFFFF',
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {['#FF5F57', '#FEBC2E', '#28C840'].map((dot) => (
                    <Box
                      key={dot}
                      aria-hidden
                      sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: dot }}
                    />
                  ))}
                  <Box
                    sx={{
                      flex: 1,
                      ml: 1,
                      px: 1.5,
                      py: 0.4,
                      borderRadius: radii.pill,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {window.location.host}/menu/{restaurantId.slice(0, 8)}…
                    </Typography>
                  </Box>
                </Stack>
                <Box
                  sx={{
                    // As tall as the phone's screen, so switching devices
                    // does not make the column jump.
                    height: phone.screenHeight - 20,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}
                >
                  {/* Same technique as PhoneFrame: a measured height plus a
                      standard transform, so sticky content is clipped and
                      there is no dead scroll space. */}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      overflow: 'hidden',
                      height:
                        desktopContent.height !== null
                          ? desktopContent.height * DESKTOP_SCALE
                          : 'auto',
                    }}
                  >
                    <Box
                      ref={desktopContent.ref}
                      sx={{
                        width: DESKTOP_WIDTH,
                        transform: `scale(${DESKTOP_SCALE})`,
                        transformOrigin: 'top left',
                        // At least the window's height, so a short menu fills it.
                        minHeight: (phone.screenHeight - 20) / DESKTOP_SCALE,
                        display: 'flex',
                        flexDirection: 'column',
                        '& > *': { flexGrow: 1 },
                      }}
                    >
                      {preview}
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
