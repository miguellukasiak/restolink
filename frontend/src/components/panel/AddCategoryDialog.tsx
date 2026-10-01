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
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import type { MenuCategory } from '../../types';
import { useAddCategory } from '../../hooks/useAddCategory';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { TonalIcon } from './TonalIcon';
import { usePanelT } from '../../i18n/panel';

// Messages are panel keys, translated where they are shown.
const addCategorySchema = z.object({
  name: z.string().trim().min(2, 'addCategory.nameMin'),
});

type AddCategoryFormValues = z.infer<typeof addCategorySchema>;

interface AddCategoryDialogProps {
  open: boolean;
  restaurantId: string;
  /** Common names not yet on the menu, offered as one-tap fills. */
  suggestions?: string[];
  onClose: () => void;
  onCreated?: (category: MenuCategory) => void;
}

/** Small modal that creates a new menu category. */
export function AddCategoryDialog({
  open,
  restaurantId,
  suggestions = [],
  onClose,
  onCreated,
}: AddCategoryDialogProps) {
  const { t } = usePanelT();
  const { showSuccess, showError } = useSnackbar();
  const addCategory = useAddCategory(restaurantId);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
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
        showSuccess(t('addCategory.created', { name: created.name }));
        onCreated?.(created);
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
          <TonalIcon>
            <PlaylistAddRoundedIcon />
          </TonalIcon>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div">
              {t('builder.newCategory')}
            </Typography>
            <Typography variant="body2" color="textSecondary" noWrap>
              {t('addCategory.subtitle')}
            </Typography>
          </Box>
          <IconButton
            aria-label={t('common.close')}
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
          label={t('category.name')}
          placeholder={t('addCategory.placeholder')}
          autoFocus
          fullWidth
          sx={{ mt: 1 }}
          error={Boolean(errors.name)}
          helperText={errors.name?.message ? t(errors.name.message) : ' '}
          disabled={isSubmitting}
          {...register('name')}
        />
        {suggestions.length > 0 && (
          <>
            <Typography variant="caption" color="textSecondary" component="p">
              {t('addCategory.popular')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {suggestions.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  variant="outlined"
                  clickable
                  disabled={isSubmitting}
                  onClick={() =>
                    setValue('name', name, { shouldValidate: true, shouldDirty: true })
                  }
                />
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {isSubmitting ? t('addCategory.creating') : t('addCategory.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
