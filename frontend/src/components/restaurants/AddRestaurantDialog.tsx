import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { usePackages } from '../../hooks/usePackages';
import { useAddRestaurant } from '../../hooks/useAddRestaurant';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { PanelLanguageField } from './PanelLanguageField';
import { LocationFields } from './LocationFields';
import { locationFor, type RestaurantLocation } from './location';

const addRestaurantSchema = z.object({
  name: z.string().trim().min(2, 'Nazwa musi mieć co najmniej 2 znaki'),
  contact_email: z.email('Podaj poprawny adres e-mail'),
  contact_phone: z.string().trim().min(9, 'Telefon musi mieć co najmniej 9 znaków'),
  package_id: z.string().min(1, 'Wybierz pakiet'),
  panel_language: z.string(),
  location: z.object({
    country: z.string().length(2),
    address: z.string(),
    currency: z.string().length(3),
    base_language: z.string().min(2),
  }),
});

type AddRestaurantFormValues = z.infer<typeof addRestaurantSchema>;

const EMPTY_FORM: AddRestaurantFormValues = {
  name: '',
  contact_email: '',
  contact_phone: '',
  package_id: '',
  panel_language: '',
  location: locationFor('PL'),
};

interface AddRestaurantDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the panel language the new restaurant was given, if any. */
  onPanelLanguage?: (code: string) => void;
}

/**
 * Modal for creating a new restaurant account. Packages for the select are
 * fetched lazily (only while the dialog is open); submission follows the same
 * spinner + snackbar + cache-invalidation pattern as the payment dialog.
 */
export function AddRestaurantDialog({
  open,
  onClose,
  onPanelLanguage,
}: AddRestaurantDialogProps) {
  const { showSuccess, showError } = useSnackbar();
  const addRestaurant = useAddRestaurant();
  const packages = usePackages(open);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddRestaurantFormValues>({
    resolver: zodResolver(addRestaurantSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      reset(EMPTY_FORM);
      addRestaurant.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    addRestaurant.mutate(
      {
        name: values.name.trim(),
        contact_email: values.contact_email.trim(),
        contact_phone: values.contact_phone.trim(),
        package_id: values.package_id,
        panel_language: values.panel_language || null,
        country: values.location.country,
        address: values.location.address.trim() || null,
        currency: values.location.currency,
        base_language: values.location.base_language,
      },
      {
        onSuccess: (created) => {
          showSuccess(`Restauracja „${created.name}" została utworzona.`);
          onClose();
          if (created.panel_language) onPanelLanguage?.(created.panel_language);
        },
        onError: (error) => {
          showError(getApiErrorMessage(error));
        },
      },
    );
  });

  const isSubmitting = addRestaurant.isPending;
  const packagesLoading = packages.isLoading;
  const packagesError = packages.isError;

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { component: 'form', onSubmit } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
            <AddBusinessRoundedIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div">
              Dodaj restaurację
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Załóż nowe konto restauratora
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
          <TextField
            label="Nazwa restauracji"
            placeholder="np. Nowa Pizzeria"
            autoFocus
            fullWidth
            error={Boolean(errors.name)}
            helperText={errors.name?.message ?? ' '}
            disabled={isSubmitting}
            {...register('name')}
          />

          <TextField
            label="Adres e-mail"
            placeholder="np. kontakt@nowapizzeria.pl"
            fullWidth
            type="email"
            error={Boolean(errors.contact_email)}
            helperText={errors.contact_email?.message ?? ' '}
            disabled={isSubmitting}
            {...register('contact_email')}
          />

          <TextField
            label="Telefon kontaktowy"
            placeholder="np. +48 987 654 321"
            fullWidth
            type="tel"
            error={Boolean(errors.contact_phone)}
            helperText={errors.contact_phone?.message ?? ' '}
            disabled={isSubmitting}
            {...register('contact_phone')}
          />

          <Controller
            name="package_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Pakiet subskrypcyjny"
                fullWidth
                error={Boolean(errors.package_id) || packagesError}
                helperText={
                  packagesError
                    ? getApiErrorMessage(packages.error)
                    : (errors.package_id?.message ?? ' ')
                }
                disabled={isSubmitting || packagesLoading}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        {packagesLoading ? (
                          <CircularProgress size={18} />
                        ) : (
                          <WorkspacePremiumRoundedIcon
                            fontSize="small"
                            color="secondary"
                          />
                        )}
                      </InputAdornment>
                    ),
                  },
                }}
              >
                {packagesLoading && (
                  <MenuItem value="" disabled>
                    Ładowanie pakietów…
                  </MenuItem>
                )}
                {(packages.data ?? []).map((pkg) => (
                  <MenuItem key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <LocationFields
                value={field.value}
                onChange={(next: RestaurantLocation) => field.onChange(next)}
                disabled={isSubmitting}
              />
            )}
          />

          <Controller
            name="panel_language"
            control={control}
            render={({ field }) => (
              <PanelLanguageField
                value={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
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
          {isSubmitting ? 'Tworzenie…' : 'Utwórz konto'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
