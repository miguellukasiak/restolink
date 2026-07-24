import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded';
import type { RestaurantListItem } from '../../types';
import { useManualPayment } from '../../hooks/useManualPayment';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';

const manualPaymentSchema = z.object({
  amount: z
    .number('Podaj prawidłową kwotę')
    .positive('Kwota musi być większa od zera')
    .max(1_000_000, 'Kwota jest zbyt wysoka'),
  notes: z.string().max(500, 'Notatka może mieć maksymalnie 500 znaków').optional(),
});

type ManualPaymentFormValues = z.infer<typeof manualPaymentSchema>;

interface ManualPaymentDialogProps {
  open: boolean;
  restaurant: RestaurantListItem | null;
  onClose: () => void;
}

/**
 * Modal for booking a traditional bank-transfer payment. Validates with zod
 * (positive amount, optional note), shows an inline spinner while submitting,
 * and reports the outcome through the global snackbar.
 */
export function ManualPaymentDialog({ open, restaurant, onClose }: ManualPaymentDialogProps) {
  const { showSuccess, showError } = useSnackbar();
  const manualPayment = useManualPayment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualPaymentFormValues>({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: { notes: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ notes: '' });
      manualPayment.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!restaurant) return;

    manualPayment.mutate(
      {
        restaurantId: restaurant.id,
        payload: {
          amount: values.amount,
          notes: values.notes?.trim() ? values.notes.trim() : undefined,
        },
      },
      {
        onSuccess: (response) => {
          const validUntil = format(
            new Date(response.updated_restaurant.new_valid_until),
            'd MMMM yyyy',
            { locale: pl },
          );
          showSuccess(
            `Płatność dla „${restaurant.name}" została zaksięgowana. Subskrypcja ważna do ${validUntil}.`,
          );
          onClose();
        },
        onError: (error) => {
          showError(getApiErrorMessage(error));
        },
      },
    );
  });

  const isSubmitting = manualPayment.isPending;

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { component: 'form', onSubmit } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
            <RequestQuoteRoundedIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div">
              Zatwierdź płatność ręcznie
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {restaurant?.name ?? '—'}
            </Typography>
          </Box>
          <IconButton
            aria-label="Zamknij"
            onClick={onClose}
            disabled={isSubmitting}
            edge="end"
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Zaksięgowanie wpłaty tradycyjnej aktywuje konto restauracji i przedłuży
            jej subskrypcję.
          </Typography>

          <TextField
            label="Kwota"
            placeholder="np. 199.00"
            autoFocus
            fullWidth
            inputMode="decimal"
            type="number"
            error={Boolean(errors.amount)}
            helperText={errors.amount?.message ?? ' '}
            disabled={isSubmitting}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">zł</InputAdornment>,
              },
              htmlInput: { step: '0.01', min: '0' },
            }}
            {...register('amount', { valueAsNumber: true })}
          />

          <TextField
            label="Notatka księgowa (opcjonalnie)"
            placeholder="np. Przelew zaksięgowany 24.07, nr ref: 12345"
            fullWidth
            multiline
            minRows={3}
            error={Boolean(errors.notes)}
            helperText={errors.notes?.message ?? ' '}
            disabled={isSubmitting}
            {...register('notes')}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Anuluj
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {isSubmitting ? 'Księgowanie…' : 'Zatwierdź płatność'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
