import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Options } from 'qr-code-styling';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { alpha } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PolylineRoundedIcon from '@mui/icons-material/PolylineRounded';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import {
  CORNER_DOT_OPTIONS,
  CORNER_SQUARE_OPTIONS,
  DEFAULT_QR_STYLE,
  DOT_TYPE_OPTIONS,
  GRADIENT_PRESETS,
  QR_PRESETS,
  SOLID_COLOR_SWATCHES,
  type QrPreset,
  type QrStyleState,
} from '../../constants/qrPresets';
import {
  QrCodeCanvas,
  type QrCodeCanvasHandle,
} from '../../components/panel/qr/QrCodeCanvas';
import {
  DotPatternPreview,
  FinderPatternPreview,
  ShapeOptionTile,
} from '../../components/panel/qr/QrShapePreview';

const PREVIEW_SIZE = 260;
/** qr-code-styling renders a vector; a large internal size keeps PNG exports crisp. */
const EXPORT_SIZE = 1024;

/** Rounded-rect color swatch that opens a native color picker on click. */
function ColorPickerDot({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <ButtonBase
        onClick={() => inputRef.current?.click()}
        aria-label={ariaLabel}
        sx={{
          width: '100%',
          height: 40,
          borderRadius: 2,
          bgcolor: value,
          border: '1px solid',
          borderColor: 'divider',
        }}
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

/** Shared border styling so each Accordion reads as its own rounded M3 surface. */
const accordionSx = {
  '&:before': { display: 'none' },
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '16px !important',
  mb: 2,
  overflow: 'hidden',
} as const;

/**
 * "Kody QR" — premium QR generator for the restaurant's public menu link.
 * Powered by qr-code-styling for real per-dot shapes, gradients, and a proper
 * logo cutout — replacing the old qrcode.react hack where "rounding" only
 * added a stroke around the whole module blob instead of shaping each dot.
 */
export function QrGeneratorPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();

  const [style, setStyle] = useState<QrStyleState>(DEFAULT_QR_STYLE);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    QR_PRESETS[0].id,
  );
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoMargin, setLogoMargin] = useState(8);
  const [downloadAnchor, setDownloadAnchor] = useState<HTMLElement | null>(null);

  const qrRef = useRef<QrCodeCanvasHandle>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Use the current browser origin so the QR + link work on localhost and on
  // any deployed domain (e.g. the Vercel production URL) without a rebuild.
  const menuUrl = `${window.location.origin}/menu/${restaurantId}`;
  const showLogo = logoEnabled && Boolean(logoSrc);

  /** Applies a manual tweak and drops out of "preset selected" state. */
  const updateStyle = (patch: Partial<QrStyleState>) => {
    setStyle((previous) => ({ ...previous, ...patch }));
    setSelectedPresetId(null);
  };

  const applyPreset = (preset: QrPreset) => {
    setStyle(preset.style);
    setSelectedPresetId(preset.id);
  };

  const qrOptions = useMemo<Partial<Options>>(() => {
    const solidColor = style.colorMode === 'solid' ? style.color : undefined;
    const gradient =
      style.colorMode === 'gradient'
        ? {
            type: style.gradientType,
            rotation:
              style.gradientType === 'linear'
                ? (style.gradientRotation * Math.PI) / 180
                : undefined,
            colorStops: [
              { offset: 0, color: style.gradientFrom },
              { offset: 1, color: style.gradientTo },
            ],
          }
        : undefined;

    return {
      width: EXPORT_SIZE,
      height: EXPORT_SIZE,
      type: 'svg',
      data: menuUrl,
      margin: 8,
      qrOptions: { errorCorrectionLevel: showLogo ? 'H' : 'M' },
      dotsOptions: { type: style.dotsType, color: solidColor, gradient },
      cornersSquareOptions: {
        type: style.cornerSquareType,
        color: solidColor,
        gradient,
      },
      cornersDotOptions: { type: style.cornerDotType, color: solidColor, gradient },
      backgroundOptions: { color: '#FFFFFF' },
      image: showLogo && logoSrc ? logoSrc : undefined,
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: logoMargin,
        imageSize: 0.28,
        hideBackgroundDots: true,
      },
    };
  }, [menuUrl, style, showLogo, logoSrc, logoMargin]);

  const handleLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      showSuccess('Link do menu został skopiowany do schowka.');
    } catch {
      showError('Nie udało się skopiować linku.');
    }
  };

  const handleDownload = async (extension: 'png' | 'svg') => {
    setDownloadAnchor(null);
    try {
      await qrRef.current?.download(extension, `menu-qr-${restaurantId.slice(0, 8)}`);
      showSuccess(`Kod QR został pobrany jako ${extension.toUpperCase()}.`);
    } catch {
      showError('Nie udało się wygenerować pliku.');
    }
  };

  const activePresetName = selectedPresetId
    ? QR_PRESETS.find((preset) => preset.id === selectedPresetId)?.name
    : null;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pt: 4 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Kody QR</Typography>
        <Typography variant="body1" color="text.secondary">
          Wybierz gotowy styl lub dostosuj każdy szczegół — kolory, kształty i
          logo — a podgląd zaktualizuje się natychmiast.
        </Typography>
      </Stack>

      {/* Preset gallery */}
      <Paper elevation={1} sx={{ borderRadius: '24px', p: 3, mb: 3 }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Gotowe style
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {QR_PRESETS.map((preset) => {
            const selected = selectedPresetId === preset.id;
            const background =
              preset.style.colorMode === 'gradient'
                ? `linear-gradient(135deg, ${preset.style.gradientFrom}, ${preset.style.gradientTo})`
                : preset.style.color;
            return (
              <ButtonBase
                key={preset.id}
                onClick={() => applyPreset(preset)}
                aria-pressed={selected}
                sx={{
                  flex: '1 1 220px',
                  maxWidth: 300,
                  textAlign: 'left',
                  borderRadius: 4,
                  p: 2,
                  border: '2px solid',
                  borderColor: selected ? 'secondary.main' : 'divider',
                  bgcolor: selected
                    ? (t) => alpha(t.palette.secondary.main, 0.08)
                    : 'background.paper',
                  transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  '&:hover': { borderColor: 'secondary.main' },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', width: '100%' }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 3,
                      flexShrink: 0,
                      background,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    <QrCode2RoundedIcon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" noWrap>
                      {preset.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      component="div"
                    >
                      {preset.description}
                    </Typography>
                  </Box>
                  {selected && (
                    <CheckCircleRoundedIcon fontSize="small" color="secondary" />
                  )}
                </Stack>
              </ButtonBase>
            );
          })}
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'flex',
          gap: 3,
          alignItems: 'flex-start',
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        {/* Left: advanced customization */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Accordion defaultExpanded disableGutters elevation={0} sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CategoryRoundedIcon fontSize="small" color="secondary" />
                <Typography variant="subtitle2" component="h2">
                  Kształty
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={3}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    Styl kropek
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {DOT_TYPE_OPTIONS.map((option) => (
                      <ShapeOptionTile
                        key={option.value}
                        selected={style.dotsType === option.value}
                        onClick={() => updateStyle({ dotsType: option.value })}
                        label={option.label}
                      >
                        <DotPatternPreview type={option.value} />
                      </ShapeOptionTile>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    Styl narożników
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {CORNER_SQUARE_OPTIONS.map((option) => (
                      <ShapeOptionTile
                        key={option.value}
                        selected={style.cornerSquareType === option.value}
                        onClick={() =>
                          updateStyle({ cornerSquareType: option.value })
                        }
                        label={option.label}
                      >
                        <FinderPatternPreview
                          squareType={option.value}
                          dotType={style.cornerDotType}
                        />
                      </ShapeOptionTile>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    Kropka narożnika
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {CORNER_DOT_OPTIONS.map((option) => (
                      <ShapeOptionTile
                        key={option.value}
                        selected={style.cornerDotType === option.value}
                        onClick={() => updateStyle({ cornerDotType: option.value })}
                        label={option.label}
                      >
                        <FinderPatternPreview
                          squareType={style.cornerSquareType}
                          dotType={option.value}
                        />
                      </ShapeOptionTile>
                    ))}
                  </Box>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters elevation={0} sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <PaletteRoundedIcon fontSize="small" color="secondary" />
                <Typography variant="subtitle2" component="h2">
                  Kolory
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2.5}>
                <ToggleButtonGroup
                  exclusive
                  value={style.colorMode}
                  onChange={(_event, value: 'solid' | 'gradient' | null) =>
                    value && updateStyle({ colorMode: value })
                  }
                  size="small"
                  color="secondary"
                  aria-label="Tryb koloru"
                >
                  <ToggleButton value="solid">Jednolity</ToggleButton>
                  <ToggleButton value="gradient">Gradient</ToggleButton>
                </ToggleButtonGroup>

                {style.colorMode === 'solid' ? (
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    {SOLID_COLOR_SWATCHES.map((swatch) => {
                      const selected = style.color === swatch.color;
                      return (
                        <ButtonBase
                          key={swatch.color}
                          onClick={() => updateStyle({ color: swatch.color })}
                          aria-label={`Kolor ${swatch.label}`}
                          aria-pressed={selected}
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: swatch.color,
                            outline: selected ? '3px solid' : '2px solid transparent',
                            outlineColor: selected
                              ? (t) => alpha(t.palette.secondary.main, 0.9)
                              : 'transparent',
                            outlineOffset: 2,
                          }}
                        />
                      );
                    })}
                    <Tooltip title="Własny kolor (HEX)" arrow>
                      <IconButton
                        aria-label="Wybierz własny kolor"
                        onClick={() => colorInputRef.current?.click()}
                        sx={{
                          width: 40,
                          height: 40,
                          border: '2px dashed',
                          borderColor: 'divider',
                        }}
                      >
                        <AddRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={style.color}
                      onChange={(event) => updateStyle({ color: event.target.value })}
                      aria-label="Własny kolor kodu QR"
                      style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        opacity: 0,
                        pointerEvents: 'none',
                      }}
                    />
                  </Stack>
                ) : (
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 1 }}
                      >
                        Szybkie zestawy
                      </Typography>
                      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                        {GRADIENT_PRESETS.map((preset) => {
                          const selected =
                            style.gradientFrom === preset.from &&
                            style.gradientTo === preset.to;
                          return (
                            <Tooltip title={preset.label} arrow key={preset.label}>
                              <ButtonBase
                                onClick={() =>
                                  updateStyle({
                                    gradientFrom: preset.from,
                                    gradientTo: preset.to,
                                  })
                                }
                                aria-label={`Gradient ${preset.label}`}
                                aria-pressed={selected}
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: '50%',
                                  background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                                  outline: selected ? '3px solid' : '2px solid transparent',
                                  outlineColor: selected
                                    ? (t) => alpha(t.palette.secondary.main, 0.9)
                                    : 'transparent',
                                  outlineOffset: 2,
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Stack>
                    </Box>

                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 1 }}
                        >
                          Kolor 1
                        </Typography>
                        <ColorPickerDot
                          value={style.gradientFrom}
                          onChange={(color) => updateStyle({ gradientFrom: color })}
                          ariaLabel="Pierwszy kolor gradientu"
                        />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 1 }}
                        >
                          Kolor 2
                        </Typography>
                        <ColorPickerDot
                          value={style.gradientTo}
                          onChange={(color) => updateStyle({ gradientTo: color })}
                          ariaLabel="Drugi kolor gradientu"
                        />
                      </Box>
                    </Stack>

                    <ToggleButtonGroup
                      exclusive
                      value={style.gradientType}
                      onChange={(_event, value: 'linear' | 'radial' | null) =>
                        value && updateStyle({ gradientType: value })
                      }
                      size="small"
                      color="secondary"
                      aria-label="Typ gradientu"
                    >
                      <ToggleButton value="linear">Liniowy</ToggleButton>
                      <ToggleButton value="radial">Radialny</ToggleButton>
                    </ToggleButtonGroup>

                    {style.gradientType === 'linear' && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          id="qr-gradient-rotation-label"
                          sx={{ display: 'block', mb: 1 }}
                        >
                          Kąt gradientu
                        </Typography>
                        <Slider
                          value={style.gradientRotation}
                          onChange={(_event, value) =>
                            updateStyle({ gradientRotation: value as number })
                          }
                          min={0}
                          max={360}
                          aria-labelledby="qr-gradient-rotation-label"
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}°`}
                          sx={{ color: 'secondary.main' }}
                        />
                      </Box>
                    )}
                  </Stack>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters elevation={0} sx={{ ...accordionSx, mb: 0 }}>
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <ImageRoundedIcon fontSize="small" color="secondary" />
                <Typography variant="subtitle2" component="h2">
                  Logo
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Switch
                    checked={logoEnabled}
                    onChange={(event) => setLogoEnabled(event.target.checked)}
                    color="secondary"
                    slotProps={{ input: { 'aria-label': 'Logo na środku kodu QR' } }}
                  />
                }
                label={
                  <Typography variant="subtitle2" component="span">
                    Logo na środku
                  </Typography>
                }
              />
              {logoEnabled && (
                <Stack spacing={2.5} sx={{ mt: 1.5 }}>
                  <ButtonBase
                    onClick={() => logoInputRef.current?.click()}
                    aria-label="Dodaj logo do kodu QR"
                    sx={{
                      width: '100%',
                      height: 96,
                      borderRadius: 3,
                      border: '2px dashed',
                      borderColor: logoSrc ? 'secondary.main' : 'divider',
                      overflow: 'hidden',
                      bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
                      '&:hover': { borderColor: 'secondary.main' },
                    }}
                  >
                    {logoSrc ? (
                      <Box
                        component="img"
                        src={logoSrc}
                        alt="Podgląd logo"
                        sx={{ height: 72, maxWidth: '80%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Stack
                        spacing={0.5}
                        sx={{ alignItems: 'center', color: 'text.secondary' }}
                      >
                        <AddPhotoAlternateRoundedIcon sx={{ opacity: 0.6 }} />
                        <Typography variant="caption">
                          Dodaj logo (PNG lub JPG)
                        </Typography>
                      </Stack>
                    )}
                  </ButtonBase>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      id="qr-logo-margin-label"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      Margines wokół logo
                    </Typography>
                    <Slider
                      value={logoMargin}
                      onChange={(_event, value) => setLogoMargin(value as number)}
                      min={0}
                      max={20}
                      aria-labelledby="qr-logo-margin-label"
                      valueLabelDisplay="auto"
                      sx={{ color: 'secondary.main' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Zapewnia czytelność kodu wokół logo.
                    </Typography>
                  </Box>
                </Stack>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={handleLogoFile}
              />
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* Right: sticky live preview + export */}
        <Paper
          elevation={1}
          sx={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            borderRadius: '24px',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            position: 'sticky',
            top: { xs: 16, md: 96 },
            order: { xs: -1, md: 0 },
          }}
        >
          <Chip
            size="small"
            color="secondary"
            variant="outlined"
            label={activePresetName ?? 'Styl niestandardowy'}
          />

          <Box
            role="img"
            aria-label={`Kod QR prowadzący do menu: ${menuUrl}`}
            sx={{
              p: 3,
              borderRadius: '28px',
              bgcolor: '#FFFFFF',
              boxShadow: '0 8px 32px rgba(28, 27, 34, 0.12)',
              lineHeight: 0,
            }}
          >
            <QrCodeCanvas ref={qrRef} options={qrOptions} previewSize={PREVIEW_SIZE} />
          </Box>

          <Button
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<DownloadRoundedIcon />}
            endIcon={<KeyboardArrowDownRoundedIcon />}
            onClick={(event) => setDownloadAnchor(event.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={downloadAnchor ? true : undefined}
            aria-controls={downloadAnchor ? 'qr-download-menu' : undefined}
          >
            Pobierz kod QR
          </Button>
          <Menu
            id="qr-download-menu"
            anchorEl={downloadAnchor}
            open={Boolean(downloadAnchor)}
            onClose={() => setDownloadAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            slotProps={{ paper: { sx: { borderRadius: 4, minWidth: 264, mt: 1 } } }}
          >
            <MenuItem onClick={() => void handleDownload('png')} sx={{ py: 1.25 }}>
              <ListItemIcon>
                <ImageRoundedIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary="Pobierz jako PNG"
                secondary="do internetu"
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
            </MenuItem>
            <MenuItem onClick={() => void handleDownload('svg')} sx={{ py: 1.25 }}>
              <ListItemIcon>
                <PolylineRoundedIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary="Pobierz jako SVG"
                secondary="do druku / Figma"
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
            </MenuItem>
          </Menu>

          <TextField
            fullWidth
            label="Link do menu"
            value={menuUrl}
            slotProps={{
              input: {
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Skopiuj link" arrow>
                      <IconButton
                        aria-label="Skopiuj link do menu"
                        onClick={() => void handleCopyLink()}
                        edge="end"
                      >
                        <ContentCopyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Paper>
      </Box>
    </Box>
  );
}
