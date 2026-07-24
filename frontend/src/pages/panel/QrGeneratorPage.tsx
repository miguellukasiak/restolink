import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
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
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';

const SWATCHES = [
  { color: '#1C1B22', label: 'Czarny' },
  { color: '#C62828', label: 'Czerwony' },
  { color: '#2E7D32', label: 'Zielony' },
  { color: '#ED6C02', label: 'Pomarańczowy' },
];

const PREVIEW_SIZE = 280;
const EXPORT_SIZE = 1024;

/**
 * "Kody QR" — live-styled QR generator for the restaurant's public menu link.
 *
 * Module rounding: qrcode.react renders square modules only, so the slider
 * applies a `stroke` with `stroke-linejoin: round` to the module path — a
 * scan-safe visual rounding that the PNG export reproduces exactly.
 */
export function QrGeneratorPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();

  const [fgColor, setFgColor] = useState('#1C1B22');
  const [radius, setRadius] = useState(0);
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const menuUrl = `http://localhost:5173/menu/${restaurantId}`;
  // Path coordinates are in module units, so stroke-width is a module fraction.
  const strokeWidth = (radius / 100) * 0.35;
  const showLogo = logoEnabled && Boolean(logoSrc);

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

  const handleDownload = () => {
    const svg = svgWrapperRef.current?.querySelector('svg');
    if (!svg) return;

    // Clone and inline the rounding stroke so it survives serialization.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const modulePath = clone.querySelector('path:last-of-type');
    if (modulePath && strokeWidth > 0) {
      modulePath.setAttribute('stroke', fgColor);
      modulePath.setAttribute('stroke-width', String(strokeWidth));
      modulePath.setAttribute('stroke-linejoin', 'round');
    }

    const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
      ctx.drawImage(image, 0, 0, EXPORT_SIZE, EXPORT_SIZE);
      URL.revokeObjectURL(svgUrl);

      const link = document.createElement('a');
      link.download = `menu-qr-${restaurantId.slice(0, 8)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showSuccess('Kod QR został pobrany jako PNG.');
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      showError('Nie udało się wygenerować pliku PNG.');
    };
    image.src = svgUrl;
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pt: 4 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Kody QR</Typography>
        <Typography variant="body1" color="text.secondary">
          Spersonalizuj kod QR prowadzący do Twojego cyfrowego menu i pobierz go
          do druku.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          gap: 3,
          alignItems: 'flex-start',
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        {/* Left: controls */}
        <Paper elevation={1} sx={{ flex: 1, minWidth: 0, borderRadius: '24px', p: 3 }}>
          <Stack spacing={4}>
            <Box>
              <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
                Kolor główny
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                {SWATCHES.map((swatch) => {
                  const selected = fgColor === swatch.color;
                  return (
                    <ButtonBase
                      key={swatch.color}
                      onClick={() => setFgColor(swatch.color)}
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
                        transition: 'outline-color 0.15s ease',
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
                  value={fgColor}
                  onChange={(event) => setFgColor(event.target.value)}
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
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                component="h2"
                id="qr-radius-label"
                sx={{ mb: 1 }}
              >
                Zaokrąglenie modułów
              </Typography>
              <Slider
                value={radius}
                onChange={(_event, value) => setRadius(value as number)}
                aria-labelledby="qr-radius-label"
                valueLabelDisplay="auto"
                marks={[
                  { value: 0, label: 'Kwadratowe' },
                  { value: 100, label: 'Zaokrąglone' },
                ]}
                sx={{ mx: 1, width: 'calc(100% - 16px)', color: 'secondary.main' }}
              />
            </Box>

            <Box>
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
                <ButtonBase
                  onClick={() => logoInputRef.current?.click()}
                  aria-label="Dodaj logo do kodu QR"
                  sx={{
                    mt: 1.5,
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
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={handleLogoFile}
              />
            </Box>
          </Stack>
        </Paper>

        {/* Right: live preview + export */}
        <Paper
          elevation={1}
          sx={{
            flex: 1,
            minWidth: 0,
            borderRadius: '24px',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Box
            ref={svgWrapperRef}
            role="img"
            aria-label={`Kod QR prowadzący do menu: ${menuUrl}`}
            sx={{
              p: 3,
              borderRadius: '28px',
              bgcolor: '#FFFFFF',
              boxShadow: '0 8px 32px rgba(28, 27, 34, 0.12)',
              lineHeight: 0,
              // Visual module rounding via stroke-linejoin on the module path.
              '& svg path:last-of-type': {
                stroke: strokeWidth > 0 ? fgColor : 'none',
                strokeWidth,
                strokeLinejoin: 'round',
              },
            }}
          >
            <QRCodeSVG
              value={menuUrl}
              size={PREVIEW_SIZE}
              fgColor={fgColor}
              bgColor="#FFFFFF"
              level={showLogo ? 'H' : 'M'}
              marginSize={1}
              imageSettings={
                showLogo && logoSrc
                  ? { src: logoSrc, width: 56, height: 56, excavate: true }
                  : undefined
              }
            />
          </Box>

          <Button
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<DownloadRoundedIcon />}
            onClick={handleDownload}
          >
            Pobierz kod QR (.png)
          </Button>

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
