import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Slider from '@mui/material/Slider';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import CropRoundedIcon from '@mui/icons-material/CropRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { getCroppedImg, blobToDataUrl } from '../../utils/getCroppedImg';
import { useSnackbar } from '../feedback/SnackbarProvider';

interface ImageCropperDialogProps {
  open: boolean;
  /** Raw, just-selected image (any aspect ratio) as a data URL. */
  imageSrc: string | null;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

/**
 * M3 dialog that forces every dish photo into a uniform 1:1 square before it
 * ever reaches the drawer's preview — pan/zoom on the source, crop happens on
 * "Zastosuj" via an offscreen canvas (see utils/getCroppedImg.ts).
 */
export function ImageCropperDialog({
  open,
  imageSrc,
  onApply,
  onCancel,
}: ImageCropperDialogProps) {
  const { showError } = useSnackbar();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const dataUrl = await blobToDataUrl(blob);
      onApply(dataUrl);
    } catch {
      showError('Nie udało się przyciąć zdjęcia. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: '28px' } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'secondary.main', width: 44, height: 44 }}>
            <CropRoundedIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div">
              Przytnij zdjęcie
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Przeciągnij i przybliż, aby dopasować kadr 1:1
            </Typography>
          </Box>
          <IconButton
            aria-label="Zamknij"
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
            height: 320,
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: '#1C1B22',
          }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 2.5 }}>
          <ZoomInRoundedIcon fontSize="small" color="action" />
          <Slider
            value={zoom}
            onChange={(_event, value) => setZoom(value as number)}
            min={1}
            max={3}
            step={0.05}
            aria-label="Przybliżenie zdjęcia"
            color="secondary"
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} color="inherit" disabled={isProcessing}>
          Anuluj
        </Button>
        <Button
          onClick={() => void handleApply()}
          variant="contained"
          color="secondary"
          disabled={isProcessing || !croppedAreaPixels}
          startIcon={
            isProcessing ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {isProcessing ? 'Przetwarzanie…' : 'Zastosuj'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
