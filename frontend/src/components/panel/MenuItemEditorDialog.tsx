import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MuiMenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import type {
  MenuCategory,
  MenuItem,
  PublicMenuItem,
  RestaurantThemeSettings,
} from '../../types';
import { ALLERGEN_OPTIONS, TAG_OPTIONS } from '../../constants/menu';
import { usePriceFormat } from '../../hooks/usePriceFormat';
import { getAllergenIcon, getTagIcon } from '../../constants/menuIcons';
import { useSaveMenuItem } from '../../hooks/useSaveMenuItem';
import { getApiErrorMessage } from '../../services/api';
import { radii } from '../../theme';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { ChoiceChips } from './ChoiceChips';
import { ConfirmDialog } from './ConfirmDialog';
import { DishPhotoField } from './DishPhotoField';
import { GuestDishPreview } from './GuestDishPreview';
import { TonalIcon } from './TonalIcon';
import { usePanelT } from '../../i18n/panel';
import { usePanelLabels } from '../../hooks/usePanelLabels';

/** "24", "24,9", "24.90" — a comma is what a Polish keyboard types. */
const PRICE_PATTERN = /^\d{1,6}(?:[.,]\d{1,2})?$/;
const TEXT_LIMIT = 500;

/** How the save shortcut is spelled on this keyboard. */
const SAVE_SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘ + Enter'
    : 'Ctrl + Enter';

const parsePrice = (value: string) => Number(value.trim().replace(',', '.'));
const formatPriceInput = (value: number) => value.toFixed(2).replace('.', ',');

// Messages are panel keys, translated where they are shown.
const dishSchema = z.object({
  name: z.string().trim().min(2, 'dishForm.nameMin').max(150, 'dishForm.nameMax'),
  // Text, not a number input: `type="number"` rejects "24,90" in browsers
  // set to an English locale, and the owner then sees a price error for a
  // perfectly ordinary Polish price.
  price: z
    .string()
    .trim()
    .min(1, 'dishForm.priceRequired')
    .regex(PRICE_PATTERN, 'dishForm.priceFormat')
    .refine((value) => parsePrice(value) > 0, 'dishForm.pricePositive')
    .refine((value) => parsePrice(value) <= 100_000, 'dishForm.priceTooHigh'),
  categoryId: z.string().min(1, 'dishForm.categoryRequired'),
  description: z.string().max(TEXT_LIMIT, 'dishForm.descriptionMax'),
  ingredients: z.string().max(TEXT_LIMIT, 'dishForm.ingredientsMax'),
  allergens: z.array(z.string()),
  tags: z.array(z.string()),
  isAvailable: z.boolean(),
  imageUrl: z.string().nullable(),
});

type DishFormValues = z.infer<typeof dishSchema>;

function formValuesFor(item: MenuItem | null, categoryId: string): DishFormValues {
  return {
    name: item?.name ?? '',
    price: item ? formatPriceInput(item.price) : '',
    categoryId: item?.category_id ?? categoryId,
    description: item?.description ?? '',
    ingredients: item?.ingredients ?? '',
    allergens: item?.allergens ?? [],
    tags: item?.tags ?? [],
    isAvailable: item?.is_available ?? true,
    imageUrl: item?.image_url ?? null,
  };
}

interface MenuItemEditorDialogProps {
  open: boolean;
  restaurantId: string;
  /** The board, for the category picker and the preview's neighbouring dish. */
  categories: MenuCategory[];
  /** Where a new dish goes; ignored when editing. */
  categoryId: string;
  /** The dish being edited, or null for a new one. */
  item: MenuItem | null;
  /** The restaurant's saved look, for the guest preview. */
  menuTheme?: RestaurantThemeSettings;
  onClose: () => void;
  /** Called with the server's copy of every saved dish. */
  onSaved: (item: MenuItem) => void;
  onRequestDelete: (item: MenuItem) => void;
}

/**
 * The dish editor: a centred, two-pane dialog — the same kind of surface as
 * "Nowa kategoria" — with the form on the left and, on the right, the dish as
 * a guest will see it, redrawn as the owner types.
 *
 * It replaces a 400px side drawer that stacked every field in one narrow
 * column. The fields are grouped in the order an owner thinks about a dish:
 * what it is and what it costs, how it's described, what's in it, whether
 * it's on today.
 */
export function MenuItemEditorDialog({
  open,
  restaurantId,
  categories,
  categoryId,
  item,
  menuTheme,
  onClose,
  onSaved,
  onRequestDelete,
}: MenuItemEditorDialogProps) {
  const { t } = usePanelT();
  const { allergenLabel, tagLabel } = usePanelLabels();
  const { symbol: priceSymbol } = usePriceFormat();
  /** A schema message (a panel key) in the panel's language. */
  const problem = (message?: string) =>
    message ? t(message, { max: TEXT_LIMIT }) : undefined;
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { showSuccess, showError } = useSnackbar();
  const saveMenuItem = useSaveMenuItem(restaurantId);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isEdit = item !== null;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<DishFormValues>({
    resolver: zodResolver(dishSchema),
    defaultValues: formValuesFor(item, categoryId),
  });

  useEffect(() => {
    if (open) {
      reset(formValuesFor(item, categoryId));
      saveMenuItem.reset();
      setConfirmDiscard(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, categoryId, reset]);

  const watched = useWatch({ control });
  const isSubmitting = saveMenuItem.isPending;

  const selectedCategory = categories.find(
    (category) => category.id === (watched.categoryId ?? categoryId),
  );

  const previewDish: PublicMenuItem = {
    id: item?.id ?? 'draft',
    category_id: watched.categoryId ?? categoryId,
    name: watched.name?.trim() || t('dishForm.name'),
    price: PRICE_PATTERN.test(watched.price?.trim() ?? '')
      ? parsePrice(watched.price ?? '')
      : 0,
    description: watched.description ?? '',
    ingredients: watched.ingredients ?? '',
    allergens: (watched.allergens ?? []).filter(Boolean) as string[],
    tags: (watched.tags ?? []).filter(Boolean) as string[],
    is_available: watched.isAvailable ?? true,
    image_url: watched.imageUrl ?? null,
  };

  const neighbour = useMemo(
    () => selectedCategory?.items.find((dish) => dish.id !== item?.id) ?? null,
    [selectedCategory, item?.id],
  );

  // The owner's own allergens and tags from the rest of the menu, offered
  // here too so "Sezam" is picked, not typed again as a slightly different
  // label.
  const customLabels = useMemo(() => {
    const allergens = new Set<string>();
    const tags = new Set<string>();
    for (const category of categories) {
      for (const dish of category.items) {
        for (const entry of dish.allergens) {
          if (!(ALLERGEN_OPTIONS as readonly string[]).includes(entry))
            allergens.add(entry);
        }
        for (const entry of dish.tags) {
          if (!(TAG_OPTIONS as readonly string[]).includes(entry)) tags.add(entry);
        }
      }
    }
    const sorted = (set: Set<string>) =>
      [...set].sort((a, b) => a.localeCompare(b, 'pl'));
    return { allergens: sorted(allergens), tags: sorted(tags) };
  }, [categories]);

  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const save = (then: 'close' | 'next') =>
    handleSubmit((values) => {
      const name = values.name.trim();
      saveMenuItem.mutate(
        {
          payload: {
            category_id: values.categoryId,
            name,
            price: parsePrice(values.price),
            description: values.description.trim() || undefined,
            ingredients: values.ingredients.trim() || undefined,
            allergens: values.allergens,
            tags: values.tags,
            is_available: values.isAvailable,
            // A fresh crop is a Data URI the API uploads to Cloudinary; an
            // untouched photo is its hosted URL, which the API passes through.
            image_url: values.imageUrl,
          },
          itemId: item?.id,
        },
        {
          onSuccess: (saved) => {
            onSaved(saved);
            if (then === 'next') {
              showSuccess(t('dishForm.addedNext', { name }));
              reset(formValuesFor(null, values.categoryId));
              // Deferred: the field is still disabled until the render that
              // follows the finished request, and a disabled input ignores focus.
              setTimeout(() => setFocus('name'), 50);
            } else {
              showSuccess(
                isEdit
                  ? t('dishForm.savedChanges', { name })
                  : t('dishForm.added', { name }),
              );
              onClose();
            }
          },
          onError: (error) => showError(getApiErrorMessage(error)),
        },
      );
    })();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save('close');
    }
  };

  const description = watched.description ?? '';

  const form = (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '176px 1fr' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ width: { xs: 176, sm: '100%' }, mx: { xs: 'auto', sm: 0 } }}>
          <Controller
            name="imageUrl"
            control={control}
            render={({ field }) => (
              <DishPhotoField
                value={field.value}
                onChange={(value) => field.onChange(value)}
                disabled={isSubmitting}
                menuBackground={menuTheme?.background_color}
              />
            )}
          />
        </Box>

        <Stack spacing={2}>
          <TextField
            label={t('dishForm.name')}
            placeholder={t('dishForm.namePlaceholder')}
            fullWidth
            autoFocus={!isEdit && !fullScreen}
            error={Boolean(errors.name)}
            helperText={problem(errors.name?.message)}
            disabled={isSubmitting}
            {...register('name')}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' },
              gap: 2,
            }}
          >
            <TextField
              label={t('dishForm.price')}
              placeholder="0,00"
              fullWidth
              error={Boolean(errors.price)}
              helperText={problem(errors.price?.message)}
              disabled={isSubmitting}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">{priceSymbol}</InputAdornment>
                  ),
                },
                htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
              }}
              {...register('price')}
            />
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label={t('dishForm.category')}
                  fullWidth
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={Boolean(errors.categoryId)}
                  helperText={problem(errors.categoryId?.message)}
                  disabled={isSubmitting}
                >
                  {categories.map((category) => (
                    <MuiMenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MuiMenuItem>
                  ))}
                </TextField>
              )}
            />
          </Box>
        </Stack>
      </Box>

      <TextField
        label={t('dishForm.description')}
        placeholder={t('dishForm.descriptionPlaceholder')}
        fullWidth
        multiline
        minRows={3}
        error={Boolean(errors.description)}
        disabled={isSubmitting}
        helperText={
          <Box
            component="span"
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
          >
            <span>
              {problem(errors.description?.message) ?? t('dishForm.descriptionHint')}
            </span>
            <span>
              {description.length}/{TEXT_LIMIT}
            </span>
          </Box>
        }
        {...register('description')}
      />

      <TextField
        label={t('dishForm.ingredients')}
        placeholder={t('dishForm.ingredientsPlaceholder')}
        fullWidth
        multiline
        minRows={2}
        error={Boolean(errors.ingredients)}
        helperText={problem(errors.ingredients?.message) ?? t('dishForm.ingredientsHint')}
        disabled={isSubmitting}
        {...register('ingredients')}
      />

      <Controller
        name="allergens"
        control={control}
        render={({ field }) => (
          <ChoiceChips
            label={t('dishForm.allergens')}
            hint={t('dishForm.allergensHint')}
            options={ALLERGEN_OPTIONS}
            known={customLabels.allergens}
            addLabel={t('dishForm.customAllergen')}
            value={field.value}
            onChange={field.onChange}
            iconFor={getAllergenIcon}
            labelFor={allergenLabel}
            tone="warning"
            disabled={isSubmitting}
          />
        )}
      />

      <Controller
        name="tags"
        control={control}
        render={({ field }) => (
          <ChoiceChips
            label={t('dishForm.tags')}
            hint={t('dishForm.tagsHint')}
            options={TAG_OPTIONS}
            known={customLabels.tags}
            addLabel={t('dishForm.customTag')}
            value={field.value}
            onChange={field.onChange}
            iconFor={getTagIcon}
            labelFor={tagLabel}
            tone="primary"
            disabled={isSubmitting}
          />
        )}
      />

      <Controller
        name="isAvailable"
        control={control}
        render={({ field }) => (
          <Stack
            component="label"
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'center',
              p: 2,
              borderRadius: radii.md,
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2">{t('dishForm.available')}</Typography>
              <Typography variant="caption" color="textSecondary" component="p">
                {field.value ? t('dishForm.availableOn') : t('dishForm.availableOff')}
              </Typography>
            </Box>
            <Switch
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
              disabled={isSubmitting}
            />
          </Stack>
        )}
      />
    </Stack>
  );

  const preview = (
    <GuestDishPreview
      dish={previewDish}
      neighbour={neighbour}
      categoryName={selectedCategory?.name ?? ''}
      menuTheme={menuTheme}
    />
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        fullScreen={fullScreen}
        maxWidth={false}
        aria-labelledby="dish-editor-title"
        slotProps={{
          paper: {
            component: 'form',
            onSubmit: (event: FormEvent) => {
              event.preventDefault();
              void save('close');
            },
            onKeyDown: handleKeyDown,
            sx: {
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              ...(fullScreen
                ? {}
                : {
                    width: 'min(1080px, calc(100% - 48px))',
                    height: 'min(820px, calc(100% - 48px))',
                    maxHeight: 'none',
                    m: 0,
                  }),
            },
          },
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'center',
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <TonalIcon>
            {isEdit ? <EditRoundedIcon /> : <RestaurantMenuRoundedIcon />}
          </TonalIcon>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2" id="dish-editor-title" noWrap>
              {isEdit
                ? t('dishForm.editTitle', { name: item.name })
                : t('dishForm.newTitle')}
            </Typography>
            <Typography variant="body2" color="textSecondary" noWrap>
              {selectedCategory
                ? t('dishForm.inCategory', { name: selectedCategory.name })
                : ' '}
            </Typography>
          </Box>
          <IconButton
            aria-label={t('common.close')}
            onClick={requestClose}
            disabled={isSubmitting}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        {/* Body: form | guest preview */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
            overflowY: { xs: 'auto', md: 'hidden' },
          }}
        >
          <Box sx={{ overflowY: { md: 'auto' }, p: { xs: 2, sm: 3 } }}>{form}</Box>
          <Box
            component="aside"
            aria-label={t('dishForm.guestPreview')}
            sx={{
              overflowY: { md: 'auto' },
              p: { xs: 2, sm: 3 },
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
              borderLeft: { md: '1px solid' },
              borderTop: { xs: '1px solid', md: 'none' },
              borderColor: { xs: 'divider', md: 'divider' },
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <VisibilityRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="subtitle2">{t('dishForm.guestsSee')}</Typography>
            </Stack>
            <Typography
              variant="caption"
              color="textSecondary"
              component="p"
              sx={{ mb: 2 }}
            >
              {t('dishForm.previewHint')}
            </Typography>
            {preview}
          </Box>
        </Box>

        {/* Footer */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            px: { xs: 2, sm: 3 },
            py: 1.75,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            bgcolor: 'background.paper',
          }}
        >
          {isEdit && (
            <Button
              color="error"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => onRequestDelete(item)}
              disabled={isSubmitting}
              sx={{ px: { xs: 1.5, sm: 2.5 } }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{ display: { xs: 'none', lg: 'block' }, mr: 1 }}
          >
            {t('dishForm.shortcutSaves', { shortcut: SAVE_SHORTCUT })}
          </Typography>
          <Button color="inherit" onClick={requestClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          {!isEdit && (
            <Button
              variant="outlined"
              onClick={() => void save('next')}
              disabled={isSubmitting}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              {t('dishForm.saveAndNext')}
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined
            }
          >
            {isSubmitting
              ? t('common.saving')
              : isEdit
                ? t('common.saveChanges')
                : t('dishForm.addToMenu')}
          </Button>
        </Stack>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        title={t('dishForm.discardTitle')}
        description={t('dishForm.discardBody')}
        confirmLabel={t('dishForm.discard')}
        cancelLabel={t('dishForm.keepEditing')}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  );
}
