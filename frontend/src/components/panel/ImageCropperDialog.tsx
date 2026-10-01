import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Slider from '@mui/material/Slider';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import CropRoundedIcon from '@mui/icons-material/CropRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import CropFreeRoundedIcon from '@mui/icons-material/CropFreeRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { getCroppedImg, blobToDataUrl } from '../../utils/getCroppedImg';
import {
  analyzePhoto,
  autoFill,
  type PhotoAnalysis,
  type PhotoFill,
} from '../../utils/photoFill';
import { hexToRgb } from '../../utils/colors';
import { radii } from '../../theme';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { TonalIcon } from './TonalIcon';
import { usePanelT } from '../../i18n/panel';
import { CustomColorSwatch } from './ColorPick';

interface ImageCropperDialogProps {
  open: boolean;
  /** Raw, just-selected image (any aspect ratio) as a data URL. */
  imageSrc: string | null;
  /** The menu's background colour, offered as one of the fills. */
  menuBackground?: string;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

/** "auto", "blur", or a colour. */
type FillChoice = 'auto' | 'blur' | string;

const MAX_ZOOM = 3;

/** Two colours this close look the same as a swatch; offer one of them. */
const alike = (a: string, b: string) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Boolean(x && y && Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 24);
};

function Swatch({
  label,
  selected,
  onClick,
  background,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  background: string;
  children?: ReactNode;
}) {
  return (
    <Tooltip title={label} arrow>
      <ButtonBase
        role="radio"
        aria-checked={selected}
        aria-label={label}
        onClick={onClick}
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: '50%',
          background,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '1px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          outline: '2px solid',
          outlineColor: (theme) =>
            selected ? theme.palette.primary.main : 'transparent',
          outlineOffset: 2,
          transition: 'outline-color 0.15s ease',
        }}
      >
        {children}
      </ButtonBase>
    </Tooltip>
  );
}

/**
 * Frames every dish photo as the square the guest menu shows — pan and zoom
 * on the photo, crop on "Apply" via an offscreen canvas.
 *
 * It opens cropped to fill the square, as it always did. A photo that is not
 * square can also be shrunk to fit whole — by the slider, or "Show whole
 * photo" — and the space around it is filled: by default with the colour of
 * its own edges when they are a plain backdrop, else with the photo blurred
 * (utils/photoFill.ts), or with whatever the owner picks below. The frame is
 * the whole square window, with the fill drawn behind the photo, so what it
 * shows is exactly what the menu will.
 */
export function ImageCropperDialog({
  open,
  imageSrc,
  menuBackground,
  onApply,
  onCancel,
}: ImageCropperDialogProps) {
  const { t } = usePanelT();
  const { showError } = useSnackbar();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [choice, setChoice] = useState<FillChoice>('auto');
  const [custom, setCustom] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setAnalysis(null);
    setChoice('auto');
    setCustom(null);
    if (!imageSrc) return;
    let current = true;
    analyzePhoto(imageSrc)
      .then((result) => current && setAnalysis(result))
      .catch(() => undefined); // The crop still works; only the fill is plain white.
    return () => {
      current = false;
    };
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // At 1 the photo covers the square; below it, it shrinks until, at this
  // zoom, the whole photo fits. A square photo has nowhere lower to go.
  const minZoom = analysis
    ? Math.min(analysis.width, analysis.height) /
      Math.max(analysis.width, analysis.height)
    : 1;
  const canShrink = minZoom < 0.99;
  const shrunk = zoom < 0.999;
  const fitsWhole = canShrink && zoom <= minZoom + 0.005;

  const fill: PhotoFill =
    choice === 'auto'
      ? analysis
        ? autoFill(analysis)
        : { kind: 'color', color: '#ffffff' }
      : choice === 'blur'
        ? { kind: 'blur' }
        : { kind: 'color', color: choice };

  const frameBackground = !analysis
    ? '#1C1B22'
    : fill.kind === 'blur'
      ? `center / cover no-repeat url("${analysis.blurred}")`
      : fill.color;

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        fill,
        analysis?.blurred,
      );
      const dataUrl = await blobToDataUrl(blob);
      onApply(dataUrl);
    } catch {
      showError(t('crop.failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const edgeSwatches = analysis?.edgeColors ?? [];
  const extras = [
    { color: '#ffffff', label: t('crop.bgWhite') },
    ...(menuBackground && hexToRgb(menuBackground)
      ? [{ color: menuBackground, label: t('crop.bgMenu') }]
      : []),
  ].filter(({ color }) => !edgeSwatches.some((edge) => alike(edge, color)));

  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <TonalIcon>
            <CropRoundedIcon />
          </TonalIcon>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div">
              {t('crop.title')}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {canShrink ? t('crop.subtitleShrink') : t('crop.subtitle')}
            </Typography>
          </Box>
          <IconButton
            aria-label={t('common.close')}
            onClick={onCancel}
            disabled={isProcessing}
            edge="end"
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: radii.md,
            overflow: 'hidden',
            background: frameBackground,
            // A white fill would otherwise melt into the white dialog, and
            // the edge of the square is exactly what the owner is judging.
            outline: '1px solid',
            outlineColor: 'divider',
            transition: 'background-color 0.2s ease',
          }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={minZoom}
              maxZoom={MAX_ZOOM}
              aspect={1}
              // The frame is the whole window, so the window is the square.
              objectFit="cover"
              // Filling the square, the photo stays over it as before;
              // shrunk, it may sit anywhere inside it.
              restrictPosition={!shrunk}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 2 }}>
          <ZoomInRoundedIcon fontSize="small" color="action" />
          <Slider
            value={zoom}
            onChange={(_event, value) => setZoom(value as number)}
            min={minZoom}
            max={MAX_ZOOM}
            step={0.01}
            aria-label={t('crop.zoom')}
          />
        </Stack>

        {canShrink && (
          <>
            <Button
              size="small"
              startIcon={fitsWhole ? <CropFreeRoundedIcon /> : <FitScreenRoundedIcon />}
              onClick={() => {
                setCrop({ x: 0, y: 0 });
                setZoom(fitsWhole ? 1 : minZoom);
              }}
              sx={{ mt: 0.5 }}
            >
              {fitsWhole ? t('crop.fillFrame') : t('crop.showWhole')}
            </Button>

            <Box sx={{ mt: 1.5 }}>
              <Typography
                variant="caption"
                component="p"
                sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}
              >
                {t('crop.background')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <CustomColorSwatch
                  value={custom ?? '#FFFFFF'}
                  onChange={(color) => {
                    setCustom(color);
                    setChoice(color);
                  }}
                  label={t('crop.background')}
                />
                <Stack
                  direction="row"
                  role="radiogroup"
                  aria-label={t('crop.background')}
                  useFlexGap
                  spacing={1}
                  sx={{ flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: 0 }}
                >
                  {custom !== null && (
                    <Swatch
                      label={t('color.yours', { hex: custom })}
                      selected={choice === custom}
                      onClick={() => setChoice(custom)}
                      background={custom}
                    />
                  )}
                  <Swatch
                    label={
                      analysis?.uniform ? t('crop.bgAutoColor') : t('crop.bgAutoBlur')
                    }
                    selected={choice === 'auto'}
                    onClick={() => setChoice('auto')}
                    background="transparent"
                  >
                    <AutoAwesomeRoundedIcon
                      sx={{ fontSize: 18, color: 'primary.main' }}
                    />
                  </Swatch>
                  {analysis && (
                    <Swatch
                      label={t('crop.bgBlur')}
                      selected={choice === 'blur'}
                      onClick={() => setChoice('blur')}
                      background={`center / cover no-repeat url("${analysis.blurred}")`}
                    />
                  )}
                  {edgeSwatches.map((color) => (
                    <Swatch
                      key={color}
                      label={t('crop.bgEdge')}
                      selected={choice === color}
                      onClick={() => setChoice(color)}
                      background={color}
                    />
                  ))}
                  {extras.map(({ color, label }) => (
                    <Swatch
                      key={color}
                      label={label}
                      selected={choice === color}
                      onClick={() => setChoice(color)}
                      background={color}
                    />
                  ))}
                </Stack>
              </Stack>
              {!shrunk && (
                <Typography
                  variant="caption"
                  component="p"
                  color="textSecondary"
                  sx={{ mt: 1 }}
                >
                  {t('crop.bgHint')}
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} color="inherit" disabled={isProcessing}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={() => void handleApply()}
          variant="contained"
          disabled={isProcessing || !croppedAreaPixels}
          startIcon={
            isProcessing ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {isProcessing ? t('crop.processing') : t('crop.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
