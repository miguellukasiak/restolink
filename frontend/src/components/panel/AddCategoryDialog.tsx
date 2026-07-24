import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import { useAddCategory } from '../../hooks/useAddCategory';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';

const addCategorySchema = z.object({
  name: z.string().trim().min(2, 'Nazwa musi mieć co najmniej 2 znaki'),
});

type AddCategoryFormValues = z.infer<typeof addCategorySchema>;

interface AddCategoryDialogProps {
  open: boolean;
  restaurantId: string;
  onClose: () => void;
}

/** Small modal that creates a new menu category. */
export function AddCategoryDialog({ open, restaurantId, onClose }: AddCategoryDialogProps) {
  const { showSuccess, showError } = useSnackbar();
  const addCategory = useAddCategory(restaurantId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddCategoryFormValues>({
    resolver: zodResolver(addCategorySchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ name: '' });
      addCategory.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    addCategory.mutate(values.name.trim(), {
      onSuccess: (created) => {
        showSuccess(`Kategoria „${created.name}" została utworzona.`);
        onClose();
      },
      onError: (error) => {
        showError(getApiErrorMessage(error));
      },
    });
  });

  const isSubmitting = addCategory.isPending;

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
          <Avatar sx={{ bgcolor: 'secondary.main', width: 44, height: 44 }}>
            <CategoryRoundedIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div">
              Nowa kategoria
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Dodaj sekcję do swojego menu
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
        <TextField
          label="Nazwa kategorii"
          placeholder="np. Napoje"
          autoFocus
          fullWidth
          sx={{ mt: 1 }}
          error={Boolean(errors.name)}
          helperText={errors.name?.message ?? ' '}
          disabled={isSubmitting}
          {...register('name')}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Anuluj
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="secondary"
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {isSubmitting ? 'Tworzenie…' : 'Utwórz kategorię'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
