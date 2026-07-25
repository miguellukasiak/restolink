import type { ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'error';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Reusable Material 3 confirmation dialog. Rounded surface, tonal warning icon,
 * pill buttons — used to guard destructive actions like deletions.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  confirmColor = 'error',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: '28px', p: 1 } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: (t) => alpha(t.palette[confirmColor].main, 0.12),
              color: `${confirmColor}.main`,
            }}
          >
            <WarningAmberRoundedIcon />
          </Avatar>
          {title}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ textAlign: 'center' }}>
          {description}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'center', gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor}
          disabled={loading}
          startIcon={
            loading ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
