import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { radii } from '../../theme';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { ImageCropperDialog } from './ImageCropperDialog';
import { usePanelT } from '../../i18n/panel';

/** What the file picker offers; every one is re-encoded to a JPEG by the crop. */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface DishPhotoFieldProps {
  /** A hosted URL, a freshly cropped Data URI, or null for no photo. */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

/**
 * Square photo tile for the dish editor.
 *
 * Accepts a click or a dropped file, and every photo goes through the 1:1
 * cropper, so the guest menu's grid stays even. Once there is a photo, "Zmień"
 * and the bin sit on the image itself rather than in a hover-only overlay —
 * a tablet behind the bar has no hover.
 */
export function DishPhotoField({
  value,
  onChange,
  disabled = false,
}: DishPhotoFieldProps) {
  const { t } = usePanelT();
  const { showError } = useSnackbar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showError(t('photo.notImage'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const pick = () => inputRef.current?.click();

  const dropHandlers = disabled
    ? {}
    : {
        onDragOver: (event: DragEvent) => {
          event.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          setDragOver(false);
          openFile(event.dataTransfer.files[0]);
        },
      };

  return (
    <>
      <Box
        {...dropHandlers}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: radii.md,
          overflow: 'hidden',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
        }}
      >
        {value ? (
          <>
            <Box
              component="img"
              src={value}
              alt={t('photo.alt')}
              decoding="async"
              sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <Stack
              direction="row"
              spacing={1}
              sx={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: 8,
                justifyContent: 'center',
              }}
            >
              <Button
                size="small"
                onClick={pick}
                disabled={disabled}
                startIcon={<PhotoCameraRoundedIcon />}
                sx={{
                  bgcolor: alpha('#FFFFFF', 0.92),
                  color: 'text.primary',
                  backdropFilter: 'blur(6px)',
                  '&:hover': { bgcolor: '#FFFFFF' },
                }}
              >
                {t('photo.change')}
              </Button>
              <Tooltip title={t('photo.remove')} arrow>
                <IconButton
                  size="small"
                  aria-label={t('photo.remove')}
                  onClick={() => onChange(null)}
                  disabled={disabled}
                  sx={{
                    bgcolor: alpha('#FFFFFF', 0.92),
                    color: 'text.secondary',
                    backdropFilter: 'blur(6px)',
                    '&:hover': { bgcolor: '#FFFFFF', color: 'error.main' },
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {dragOver && (
              <Stack
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (t) => alpha(t.palette.primary.dark, 0.72),
                  color: '#FFFFFF',
                }}
              >
                <Typography variant="subtitle2">{t('photo.dropToReplace')}</Typography>
              </Stack>
            )}
          </>
        ) : (
          <ButtonBase
            onClick={pick}
            disabled={disabled}
            aria-label={t('photo.addAria')}
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              border: '2px dashed',
              borderColor: (t) => alpha(t.palette.primary.main, dragOver ? 0.9 : 0.3),
              bgcolor: (t) => alpha(t.palette.primary.main, dragOver ? 0.1 : 0),
              flexDirection: 'column',
              gap: 1,
              px: 2,
              transition: 'border-color 0.2s ease, background-color 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
              },
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                color: 'primary.main',
              }}
            >
              <AddPhotoAlternateRoundedIcon />
            </Box>
            <Typography variant="subtitle2">{t('photo.add')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {dragOver ? t('photo.dropHere') : t('photo.dragOrClick')}
            </Typography>
          </ButtonBase>
        )}
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so picking the same file again still fires a change event.
          event.target.value = '';
          openFile(file);
        }}
      />

      <ImageCropperDialog
        open={cropperSrc !== null}
        imageSrc={cropperSrc}
        onApply={(cropped) => {
          onChange(cropped);
          setCropperSrc(null);
        }}
        onCancel={() => setCropperSrc(null)}
      />
    </>
  );
}
