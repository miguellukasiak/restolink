import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { useCreateAdmin } from '../../hooks/useHq';
import { getApiErrorMessage } from '../../services/api';

/** Matches the backend bound; bcrypt hashes only the first 72 bytes. */
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72;

interface AddAdminDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Dodaj administratora".
 *
 * The password is typed here and travels once. It is deliberately not generated
 * for the operator and not shown back afterwards: whoever creates the account
 * has to hand it over out of band, and a credential echoed into a success toast
 * ends up in a screenshot.
 */
export function AddAdminDialog({ open, onClose }: AddAdminDialogProps) {
  const { showSuccess, showError } = useSnackbar();
  const create = useCreateAdmin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Clear on open rather than on close: leaving a password in component state
  // until the next mount keeps it in memory for no reason.
  useEffect(() => {
    if (open) {
      setEmail('');
      setPassword('');
    }
  }, [open]);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const tooLong = new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
  const canSubmit =
    email.includes('@') && password.length >= MIN_PASSWORD && !tooLong;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      const created = await create.mutateAsync({ email, password });
      setPassword('');
      showSuccess(`Dodano administratora ${created.email}.`);
      onClose();
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Dodaj administratora</DialogTitle>
        <DialogContent>
          <DialogContentText variant="body2" sx={{ mb: 2.5 }}>
            Konto od razu otrzymuje pełny dostęp do panelu HQ. Hasło przekaż
            właścicielowi konta osobno — nie zobaczysz go tu ponownie.
          </DialogContentText>

          <Stack spacing={2.5}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
              fullWidth
              autoFocus
              disabled={create.isPending}
            />
            <TextField
              label="Hasło"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              fullWidth
              disabled={create.isPending}
              error={tooShort || tooLong}
              helperText={
                tooLong
                  ? `Hasło może mieć najwyżej ${MAX_PASSWORD_BYTES} bajtów.`
                  : `Minimum ${MIN_PASSWORD} znaków.`
              }
            />
            {create.isError && (
              <Alert severity="error">{getApiErrorMessage(create.error)}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={onClose} disabled={create.isPending}>
            Anuluj
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSubmit || create.isPending}
            startIcon={
              create.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : null
            }
          >
            Dodaj
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
