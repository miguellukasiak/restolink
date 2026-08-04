import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SellRoundedIcon from '@mui/icons-material/SellRounded';
import type { MenuItem as MenuItemType } from '../../types';
import { ALLERGEN_OPTIONS, TAG_OPTIONS } from '../../constants/menu';
import { useSaveMenuItem } from '../../hooks/useSaveMenuItem';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { ImageCropperDialog } from './ImageCropperDialog';

const menuItemSchema = z.object({
  name: z.string().trim().min(2, 'Nazwa musi mieć co najmniej 2 znaki'),
  price: z
    .number('Podaj prawidłową cenę')
    .positive('Cena musi być większa od zera')
    .max(100_000, 'Cena jest zbyt wysoka'),
  description: z.string().max(500, 'Opis może mieć maksymalnie 500 znaków').optional(),
  ingredients: z
    .string()
    .max(500, 'Lista składników może mieć maksymalnie 500 znaków')
    .optional(),
  allergens: z.array(z.string()),
  tags: z.array(z.string()),
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;

interface MenuItemDrawerProps {
  open: boolean;
  restaurantId: string;
  /** Category the dish belongs to (target category when creating). */
  categoryId: string;
  categoryName: string;
  /** Dish being edited, or null when creating a new one. */
  item: MenuItemType | null;
  onClose: () => void;
}

/** Toggles a value inside a react-hook-form string-array field. */
function toggleValue(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
}

/**
 * Right-side slide-out editor for a dish. Keeps the menu board visible behind
 * it (no centered modal), validates with zod and saves through the menu API.
 */
export function MenuItemDrawer({
  open,
  restaurantId,
  categoryId,
  categoryName,
  item,
  onClose,
}: MenuItemDrawerProps) {
  const { showSuccess, showError } = useSnackbar();
  const saveMenuItem = useSaveMenuItem(restaurantId);
  const isEdit = Boolean(item);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: { allergens: [], tags: [] },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: item?.name ?? '',
        price: item?.price ?? (undefined as unknown as number),
        description: item?.description ?? '',
        ingredients: item?.ingredients ?? '',
        allergens: item?.allergens ?? [],
        tags: item?.tags ?? [],
      });
      setImagePreview(item?.image_url ?? null);
      saveMenuItem.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, reset]);

  const onSubmit = handleSubmit((values) => {
    saveMenuItem.mutate(
      {
        payload: {
          category_id: item?.category_id ?? categoryId,
          name: values.name.trim(),
          price: values.price,
          description: values.description?.trim() || undefined,
          ingredients: values.ingredients?.trim() || undefined,
          allergens: values.allergens,
          tags: values.tags,
          is_available: item?.is_available ?? true,
          // Either a freshly-cropped Base64 Data URI (the API uploads it to
          // Cloudinary and stores the URL) or the existing hosted URL when the
          // photo wasn't touched — the backend passes those through untouched.
          image_url: imagePreview,
        },
        itemId: item?.id,
      },
      {
        onSuccess: () => {
          showSuccess(
            isEdit
              ? `Danie „${values.name.trim()}" zostało zaktualizowane.`
              : `Danie „${values.name.trim()}" zostało dodane do menu.`,
          );
          onClose();
        },
        onError: (error) => {
          showError(getApiErrorMessage(error));
        },
      },
    );
  });

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so re-selecting the same file still fires a change event later.
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleCropApply = (croppedDataUrl: string) => {
    setImagePreview(croppedDataUrl);
    setCropperSrc(null);
  };

  const isSubmitting = saveMenuItem.isPending;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={isSubmitting ? undefined : onClose}
        // Slide over the fixed AppBar (drawer + 1) instead of being clipped under it.
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 400 },
              borderTopLeftRadius: 24,
              borderBottomLeftRadius: 24,
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Box
          component="form"
          onSubmit={onSubmit}
          sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        >
          {/* Header */}
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', px: 3, pt: 3, pb: 2 }}
          >
            <Avatar sx={{ bgcolor: 'secondary.main', width: 44, height: 44 }}>
              {isEdit ? <EditRoundedIcon /> : <RestaurantMenuRoundedIcon />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="div" noWrap>
                {isEdit ? 'Edytuj danie' : 'Nowe danie'}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                Kategoria: {categoryName}
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
          <Divider />

          {/* Scrollable form body */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
            <Stack spacing={2.5}>
              {/* Image dropzone placeholder */}
              <ButtonBase
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                sx={{
                  borderRadius: 4,
                  border: '2px dashed',
                  borderColor: imagePreview ? 'secondary.main' : 'divider',
                  height: 140,
                  width: '100%',
                  overflow: 'hidden',
                  bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
                  transition: 'border-color 0.2s ease, background-color 0.2s ease',
                  '&:hover': {
                    borderColor: 'secondary.main',
                    bgcolor: (t) => alpha(t.palette.secondary.main, 0.08),
                  },
                }}
              >
                {imagePreview ? (
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Podgląd zdjęcia dania"
                    loading="lazy"
                    decoding="async"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Stack spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <AddPhotoAlternateRoundedIcon sx={{ fontSize: 32, opacity: 0.6 }} />
                    <Typography variant="subtitle2">Dodaj zdjęcie</Typography>
                    <Typography variant="caption">PNG lub JPG, maks. 5 MB</Typography>
                  </Stack>
                )}
              </ButtonBase>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={handleImageChange}
              />

              <TextField
                label="Nazwa dania"
                placeholder="np. Bruschetta Pomodoro"
                fullWidth
                autoFocus={!isEdit}
                error={Boolean(errors.name)}
                helperText={errors.name?.message ?? ' '}
                disabled={isSubmitting}
                {...register('name')}
              />

              <TextField
                label="Cena"
                placeholder="np. 24.90"
                fullWidth
                type="number"
                inputMode="decimal"
                error={Boolean(errors.price)}
                helperText={errors.price?.message ?? ' '}
                disabled={isSubmitting}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">zł</InputAdornment>,
                  },
                  htmlInput: { step: '0.01', min: '0' },
                }}
                {...register('price', { valueAsNumber: true })}
              />

              <TextField
                label="Opis"
                placeholder="Krótki opis widoczny dla gości"
                fullWidth
                multiline
                minRows={2}
                error={Boolean(errors.description)}
                helperText={errors.description?.message ?? ' '}
                disabled={isSubmitting}
                {...register('description')}
              />

              <TextField
                label="Składniki"
                placeholder="np. pomidory, bazylia, oliwa z oliwek"
                fullWidth
                multiline
                minRows={2}
                error={Boolean(errors.ingredients)}
                helperText={errors.ingredients?.message ?? ' '}
                disabled={isSubmitting}
                {...register('ingredients')}
              />

              {/* Allergens */}
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', mb: 1 }}
                  >
                    <WarningAmberRoundedIcon color="warning" fontSize="small" />
                    <Typography variant="subtitle2">Alergeny</Typography>
                  </Stack>
                  <Controller
                    name="allergens"
                    control={control}
                    render={({ field }) => (
                      <FormGroup row>
                        {ALLERGEN_OPTIONS.map((allergen) => (
                          <FormControlLabel
                            key={allergen}
                            sx={{ width: '50%', mr: 0 }}
                            control={
                              <Checkbox
                                size="small"
                                color="warning"
                                checked={field.value.includes(allergen)}
                                onChange={() =>
                                  field.onChange(toggleValue(field.value, allergen))
                                }
                                disabled={isSubmitting}
                              />
                            }
                            label={
                              <Typography variant="body2">{allergen}</Typography>
                            }
                          />
                        ))}
                      </FormGroup>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Tags */}
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', mb: 1 }}
                  >
                    <SellRoundedIcon color="secondary" fontSize="small" />
                    <Typography variant="subtitle2">Tagi</Typography>
                  </Stack>
                  <Controller
                    name="tags"
                    control={control}
                    render={({ field }) => (
                      <FormGroup row>
                        {TAG_OPTIONS.map((tag) => (
                          <FormControlLabel
                            key={tag}
                            sx={{ width: '50%', mr: 0 }}
                            control={
                              <Checkbox
                                size="small"
                                color="secondary"
                                checked={field.value.includes(tag)}
                                onChange={() =>
                                  field.onChange(toggleValue(field.value, tag))
                                }
                                disabled={isSubmitting}
                              />
                            }
                            label={<Typography variant="body2">{tag}</Typography>}
                          />
                        ))}
                      </FormGroup>
                    )}
                  />
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Sticky footer */}
          <Divider />
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ px: 3, py: 2, justifyContent: 'flex-end' }}
          >
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
              {isSubmitting ? 'Zapisywanie…' : 'Zapisz danie'}
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <ImageCropperDialog
        open={cropperSrc !== null}
        imageSrc={cropperSrc}
        onApply={handleCropApply}
        onCancel={() => setCropperSrc(null)}
      />
    </>
  );
}
