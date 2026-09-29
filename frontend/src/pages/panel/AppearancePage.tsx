import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ThemeProvider } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SmartphoneRoundedIcon from '@mui/icons-material/SmartphoneRounded';
import DesktopWindowsRoundedIcon from '@mui/icons-material/DesktopWindowsRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ColorizeRoundedIcon from '@mui/icons-material/ColorizeRounded';
import {
  BACKGROUND_COLOR_PRESETS,
  FONT_OPTIONS,
  PRIMARY_COLOR_PRESETS,
  THEME_PRESETS,
} from '../../constants/menu';
import type { ThemePreset } from '../../constants/menu';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { useUpdateTheme } from '../../hooks/useUpdateTheme';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { createRestaurantTheme } from '../../components/public/RestaurantThemeProvider';
import { PublicMenuView } from '../../components/public/PublicMenuView';
import { MenuSkeleton } from '../../components/public/MenuSkeleton';
import { PhoneFrame } from '../../components/panel/PhoneFrame';
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight';
import { radii } from '../../theme';

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface ThemeFormValues {
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  font_family: string;
}

/** Guards live-preview values: mid-typing hex like "#8C1" must not reach createTheme. */
const safeHex = (value: string | undefined, fallback: string) =>
  value && HEX_PATTERN.test(value) ? value : fallback;

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: readonly string[];
  error?: string;
}

/** Preset swatches + hex input + native color picker for one color setting. */
function ColorField({ label, value, onChange, presets, error }: ColorFieldProps) {
  const nativeInputRef = useRef<HTMLInputElement>(null);

  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        {presets.map((preset) => (
          <ButtonBase
            key={preset}
            onClick={() => onChange(preset)}
            aria-label={`${label}: ${preset}`}
            aria-pressed={value.toLowerCase() === preset.toLowerCase()}
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: preset,
              border: '1px solid',
              borderColor: 'divider',
              outline:
                value.toLowerCase() === preset.toLowerCase()
                  ? '3px solid'
                  : '3px solid transparent',
              outlineColor:
                value.toLowerCase() === preset.toLowerCase()
                  ? (t) => alpha(t.palette.secondary.main, 0.9)
                  : 'transparent',
              outlineOffset: 2,
            }}
          />
        ))}
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
              <Tooltip title="Wybierz z palety" arrow>
                <IconButton
                  size="small"
                  aria-label={`${label} — wybierz z palety`}
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
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label} — paleta kolorów`}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </Box>
  );
}

/**
 * "Wygląd menu" — Linktree-style visual configuration. Left: form (react-hook-form,
 * useWatch). Right: sticky device preview rendering the real PublicMenuView with
 * the *unsaved* watched values applied through the restaurant theme factory.
 */
export function AppearancePage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();
  const menu = usePublicMenu(restaurantId);
  const updateTheme = useUpdateTheme(restaurantId);

  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);

  // The desktop preview lays the menu out at 1024px and scales it down; see
  // useMeasuredHeight for why its wrapper is sized from a measurement. (The
  // phone preview does the same inside PhoneFrame.)
  const desktopContent = useMeasuredHeight(`${device}-${menu.isLoading}`);

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
    },
  });

  // Hydrate the form once from the saved theme.
  useEffect(() => {
    if (menu.data && !hydratedRef.current) {
      hydratedRef.current = true;
      reset(menu.data.restaurant.theme);
    }
  }, [menu.data, reset]);

  const watched = useWatch({ control });

  const previewTheme = createRestaurantTheme({
    primary_color: safeHex(watched.primary_color, '#8C1D18'),
    background_color: safeHex(watched.background_color, '#FCF4F6'),
    font_family: watched.font_family,
  });

  const handleLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setValue('logo_url', String(reader.result), { shouldDirty: true });
    reader.readAsDataURL(file);
  };

  // One-tap preset: overwrite the three visual fields with a curated,
  // contrast-safe combination and mark the form dirty so it can be saved.
  const applyPreset = (preset: ThemePreset) => {
    const options = { shouldDirty: true, shouldValidate: true };
    setValue('primary_color', preset.primary_color, options);
    setValue('background_color', preset.background_color, options);
    setValue('font_family', preset.font_family, options);
  };

  const activePresetId = THEME_PRESETS.find(
    (preset) =>
      preset.primary_color.toLowerCase() === watched.primary_color?.toLowerCase() &&
      preset.background_color.toLowerCase() === watched.background_color?.toLowerCase() &&
      preset.font_family === watched.font_family,
  )?.id;

  const onSubmit = handleSubmit((values) => {
    updateTheme.mutate(values, {
      onSuccess: () => {
        showSuccess('Ustawienia wyglądu zostały zapisane.');
        reset(values);
      },
      onError: (error) => showError(getApiErrorMessage(error)),
    });
  });

  const isSaving = updateTheme.isPending;

  // Same rich, page-shaped skeleton used on the live public menu — shown until
  // the first fetch resolves (React Query keeps `data` truthy afterwards, so
  // saves/refetches never flash back to this state).
  const preview =
    menu.isLoading || !menu.data ? (
      <MenuSkeleton />
    ) : (
      <ThemeProvider theme={previewTheme}>
        <Box sx={{ pointerEvents: 'none', bgcolor: 'background.default' }}>
          <PublicMenuView
            restaurantName={menu.data.restaurant.name}
            logoUrl={watched.logo_url}
            categories={menu.data.categories}
          />
        </Box>
      </ThemeProvider>
    );

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto', pt: 4 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Wygląd menu</Typography>
        <Typography variant="body1" color="text.secondary">
          Dostosuj wygląd swojego cyfrowego menu. Podgląd po prawej reaguje na
          zmiany natychmiast — zapisz, gdy będziesz zadowolony z efektu.
        </Typography>
      </Stack>

      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{
          display: 'flex',
          gap: 4,
          alignItems: 'flex-start',
          flexDirection: { xs: 'column', lg: 'row' },
        }}
      >
        {/* Left: scrollable configuration form */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Stack spacing={3}>
            <Paper elevation={1} sx={{ borderRadius: '24px', p: 3 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
                Gotowe motywy
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Zacznij od gotowej, czytelnej kombinacji — dopracujesz szczegóły niżej.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(3, 1fr)',
                  },
                  gap: 1.5,
                }}
              >
                {THEME_PRESETS.map((preset) => {
                  const isActive = preset.id === activePresetId;
                  return (
                    <ButtonBase
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      aria-label={`Zastosuj motyw: ${preset.label}`}
                      aria-pressed={isActive}
                      sx={{
                        display: 'block',
                        textAlign: 'left',
                        borderRadius: '18px',
                        p: 1.5,
                        border: '2px solid',
                        borderColor: isActive ? 'secondary.main' : 'transparent',
                        bgcolor: (t) =>
                          alpha(t.palette.secondary.main, isActive ? 0.12 : 0.06),
                        transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.secondary.main, 0.14),
                        },
                      }}
                    >
                      {/* Mini swatch: background surface with a primary accent bar. */}
                      <Box
                        aria-hidden
                        sx={{
                          height: 56,
                          borderRadius: '12px',
                          bgcolor: preset.background_color,
                          border: '1px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'flex-end',
                          p: 1,
                          mb: 1,
                        }}
                      >
                        <Box
                          sx={{
                            height: 8,
                            width: '60%',
                            borderRadius: 999,
                            bgcolor: preset.primary_color,
                          }}
                        />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {preset.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                        sx={{ lineHeight: 1.3 }}
                      >
                        {preset.description}
                      </Typography>
                    </ButtonBase>
                  );
                })}
              </Box>
            </Paper>

            <Paper elevation={1} sx={{ borderRadius: '24px', p: 3 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Logo Restauracji
              </Typography>
              <Controller
                name="logo_url"
                control={control}
                render={({ field }) => (
                  <Box>
                    <ButtonBase
                      onClick={() => logoInputRef.current?.click()}
                      aria-label="Dodaj logo restauracji"
                      sx={{
                        width: '100%',
                        height: 120,
                        borderRadius: radii.md,
                        border: '2px dashed',
                        borderColor: field.value ? 'secondary.main' : 'divider',
                        overflow: 'hidden',
                        bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
                        '&:hover': { borderColor: 'secondary.main' },
                      }}
                    >
                      {field.value ? (
                        <Box
                          component="img"
                          src={field.value}
                          alt="Podgląd logo restauracji"
                          sx={{ height: 96, maxWidth: '80%', objectFit: 'contain' }}
                        />
                      ) : (
                        <Stack
                          spacing={0.5}
                          sx={{ alignItems: 'center', color: 'text.secondary' }}
                        >
                          <AddPhotoAlternateRoundedIcon sx={{ opacity: 0.6 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Dodaj logo
                          </Typography>
                          <Typography variant="caption">
                            PNG lub JPG, najlepiej kwadratowe
                          </Typography>
                        </Stack>
                      )}
                    </ButtonBase>
                    {field.value && (
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<DeleteOutlineRoundedIcon />}
                        onClick={() =>
                          setValue('logo_url', null, { shouldDirty: true })
                        }
                        sx={{ mt: 1 }}
                      >
                        Usuń logo
                      </Button>
                    )}
                  </Box>
                )}
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={handleLogoFile}
              />
            </Paper>

            <Paper elevation={1} sx={{ borderRadius: '24px', p: 3 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Kolorystyka
              </Typography>
              <Stack spacing={2.5}>
                <Controller
                  name="primary_color"
                  control={control}
                  rules={{
                    pattern: {
                      value: HEX_PATTERN,
                      message: 'Podaj kolor w formacie #RRGGBB',
                    },
                  }}
                  render={({ field }) => (
                    <ColorField
                      label="Kolor główny"
                      value={field.value}
                      onChange={field.onChange}
                      presets={PRIMARY_COLOR_PRESETS}
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
                      message: 'Podaj kolor w formacie #RRGGBB',
                    },
                  }}
                  render={({ field }) => (
                    <ColorField
                      label="Kolor tła"
                      value={field.value}
                      onChange={field.onChange}
                      presets={BACKGROUND_COLOR_PRESETS}
                      error={errors.background_color?.message}
                    />
                  )}
                />
              </Stack>
            </Paper>

            <Paper elevation={1} sx={{ borderRadius: '24px', p: 3 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Typografia
              </Typography>
              <Controller
                name="font_family"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="Krój pisma"
                    slotProps={{
                      htmlInput: { 'aria-label': 'Krój pisma menu' },
                    }}
                  >
                    {FONT_OPTIONS.map((option) => (
                      <MenuItem
                        key={option.value}
                        value={option.value}
                        sx={{ fontFamily: option.stack, fontSize: 18 }}
                      >
                        {option.value}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Paper>
          </Stack>

          {/* Sticky save bar */}
          <Box sx={{ position: 'sticky', bottom: 16, mt: 3, zIndex: 2 }}>
            <Paper
              elevation={4}
              sx={{
                borderRadius: 999,
                px: 3,
                py: 1.5,
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
                {isDirty ? 'Masz niezapisane zmiany' : 'Wszystkie zmiany zapisane'}
              </Typography>
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                disabled={!isDirty || isSaving}
                startIcon={
                  isSaving ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SaveRoundedIcon />
                  )
                }
              >
                {isSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}
              </Button>
            </Paper>
          </Box>
        </Box>

        {/* Right: sticky live preview. The device-type toggle sits above the
            mockup, so on desktop we nudge the whole column up a touch to keep the
            phone visually aligned with the top of the form column on the left
            (the form already top-aligns both via alignItems: flex-start). */}
        <Box
          sx={{
            width: { xs: '100%', lg: 470 },
            flexShrink: 0,
            position: { lg: 'sticky' },
            top: { lg: 88 },
            mt: { lg: -3 },
          }}
        >
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <ToggleButtonGroup
              value={device}
              exclusive
              onChange={(_event, value: 'mobile' | 'desktop' | null) => {
                if (value) setDevice(value);
              }}
              size="small"
              aria-label="Tryb podglądu"
            >
              <ToggleButton value="mobile" aria-label="Podgląd mobilny">
                <SmartphoneRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                Mobile
              </ToggleButton>
              <ToggleButton value="desktop" aria-label="Podgląd na komputerze">
                <DesktopWindowsRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                Desktop
              </ToggleButton>
            </ToggleButtonGroup>

            {device === 'mobile' ? (
              <PhoneFrame
                address={`restolink.app/menu/${restaurantId.slice(0, 8)}…`}
                measureKey={menu.isLoading}
              >
                {preview}
              </PhoneFrame>
            ) : (
              /* Browser window frame */
              <Box
                sx={{
                  width: '100%',
                  borderRadius: '20px',
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
                      borderRadius: 999,
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
                    height: 420,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}
                >
                  {/* See the mobile frame's comment above: measured height + standard
                      `transform: scale` (not `zoom`) so sticky content is reliably
                      clipped and there's no dead scroll space. */}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      overflow: 'hidden',
                      height:
                        desktopContent.height !== null
                          ? desktopContent.height * 0.4375
                          : 'auto',
                    }}
                  >
                    <Box
                      ref={desktopContent.ref}
                      sx={{ width: 1024, transform: 'scale(0.4375)', transformOrigin: 'top left' }}
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
