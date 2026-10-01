import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { useUpdateRestaurant } from '../../hooks/useOnboarding';
import { useAdminPanelLocales } from '../../hooks/usePanelLocales';
import { panelLanguageState } from '../../services/panelTranslation';
import { getApiErrorMessage } from '../../services/api';
import type { RestaurantListItem } from '../../types';
import { PanelLanguageField } from './PanelLanguageField';
import { LocationFields } from './LocationFields';
import { locationFor, type RestaurantLocation } from './location';

/** What a restaurant row says about where it is, as the form holds it. */
const locationOf = (restaurant: RestaurantListItem): RestaurantLocation => ({
  country: restaurant.country,
  address: restaurant.address ?? '',
  currency: restaurant.currency,
  base_language: restaurant.base_language,
});

interface EditRestaurantDialogProps {
  open: boolean;
  restaurant: RestaurantListItem | null;
  onClose: () => void;
  /** Called after a save when the panel language still needs DeepL. */
  onPanelLanguage?: (code: string) => void;
}

/**
 * "Edytuj dane" — the fix for a mistyped address.
 *
 * The note about the activation link is not decoration: correcting the email
 * here changes where the *next* link goes, and for an account that has not
 * activated yet it also changes the address they will sign in with. Nothing
 * re-sends on save, so the operator has to press the send action afterwards —
 * an edit that quietly emailed the customer would be a surprise.
 */
export function EditRestaurantDialog({
  open,
  restaurant,
  onClose,
  onPanelLanguage,
}: EditRestaurantDialogProps) {
  const { showSuccess, showError } = useSnackbar();
  const update = useUpdateRestaurant();
  const panelLocales = useAdminPanelLocales();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [panelLanguage, setPanelLanguage] = useState('');
  const [location, setLocation] = useState<RestaurantLocation>(locationFor('PL'));

  // Reseed whenever a different row opens the dialog, so it never shows the
  // previous restaurant's details for a frame.
  useEffect(() => {
    if (open && restaurant) {
      setName(restaurant.name);
      setEmail(restaurant.contact_email);
      setPhone(restaurant.contact_phone);
      setPanelLanguage(restaurant.panel_language ?? '');
      setLocation(locationOf(restaurant));
    }
  }, [open, restaurant]);

  const saved = restaurant ? locationOf(restaurant) : null;
  const locationChanges: Partial<RestaurantLocation> = saved
    ? Object.fromEntries(
        (Object.keys(location) as (keyof RestaurantLocation)[])
          .filter((key) => location[key].trim() !== saved[key].trim())
          .map((key) => [key, location[key].trim()]),
      )
    : {};
  const changed =
    Boolean(restaurant) &&
    (name !== restaurant?.name ||
      email !== restaurant?.contact_email ||
      phone !== restaurant?.contact_phone ||
      panelLanguage !== (restaurant?.panel_language ?? '') ||
      Object.keys(locationChanges).length > 0);
  // A language whose translation was stopped midway can be finished by
  // saving again, with nothing else changed.
  const untranslated =
    Boolean(panelLanguage) &&
    panelLocales.isSuccess &&
    panelLanguageState(panelLanguage, panelLocales.data) === 'missing';
  const dirty = changed || untranslated;
  const valid = name.trim().length > 0 && email.includes('@') && phone.trim().length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!restaurant || !dirty || !valid) return;

    try {
      // Only what actually changed: the endpoint records the edit in the audit
      // log, and a diff full of unchanged fields makes that entry useless.
      if (changed) {
        await update.mutateAsync({
          restaurantId: restaurant.id,
          payload: {
            ...(name !== restaurant.name ? { name } : {}),
            ...(email !== restaurant.contact_email ? { contact_email: email } : {}),
            ...(phone !== restaurant.contact_phone ? { contact_phone: phone } : {}),
            ...(panelLanguage !== (restaurant.panel_language ?? '')
              ? { panel_language: panelLanguage || null }
              : {}),
            ...locationChanges,
          },
        });
        showSuccess('Dane zaktualizowane.');
      }
      onClose();
      if (untranslated) onPanelLanguage?.(panelLanguage);
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Edytuj dane restauracji</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            <TextField
              label="Nazwa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              autoFocus
              disabled={update.isPending}
            />
            <TextField
              label="E-mail kontaktowy"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              disabled={update.isPending}
              helperText="Na ten adres trafi kolejny link aktywacyjny."
            />
            <TextField
              label="Telefon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              fullWidth
              disabled={update.isPending}
            />
            <LocationFields
              value={location}
              onChange={setLocation}
              disabled={update.isPending}
              languageWarning={
                locationChanges.base_language
                  ? 'Wpisane już dania zostają, jak są — zmiana ich nie tłumaczy.'
                  : undefined
              }
            />
            <PanelLanguageField
              value={panelLanguage}
              onChange={setPanelLanguage}
              disabled={update.isPending}
            />
            <Alert severity="info" sx={{ borderRadius: '12px' }}>
              Zapisanie zmian nie wysyła żadnej wiadomości. Po poprawieniu adresu użyj
              akcji „Wyślij link aktywacyjny”.
            </Alert>
            {update.isError && (
              <Alert severity="error">{getApiErrorMessage(update.error)}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={onClose} disabled={update.isPending}>
            Anuluj
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!dirty || !valid || update.isPending}
            startIcon={
              update.isPending ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            Zapisz
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
