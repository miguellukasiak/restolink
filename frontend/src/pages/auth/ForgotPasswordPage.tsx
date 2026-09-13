import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { getApiErrorMessage } from '../../services/api';
import { requestPasswordReset } from '../../services/authService';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // The backend answers the same way whether or not the address is
      // registered, and this screen shows exactly that message. Saying "we sent
      // it" or "no such account" would turn the form into a way to find out
      // which restaurants use RestoLink.
      setSentMessage(await requestPasswordReset(email.trim()));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentMessage) {
    return (
      <AuthLayout
        title="Sprawdź skrzynkę"
        subtitle="Jeśli konto istnieje, link do zmiany hasła jest już w drodze."
        footer={
          <Link component={RouterLink} to="/login" underline="hover" variant="body2">
            Wróć do logowania
          </Link>
        }
      >
        <Stack spacing={2}>
          <Alert severity="success" sx={{ borderRadius: '16px' }}>
            {sentMessage}
          </Alert>
          <Alert severity="info" sx={{ borderRadius: '16px' }}>
            Link jest ważny przez 30 minut i zadziała tylko raz. Jeśli wiadomość
            nie dotarła, sprawdź folder ze spamem.
          </Alert>
          <Button
            variant="text"
            onClick={() => setSentMessage(null)}
            sx={{ borderRadius: '999px' }}
          >
            Wpisz inny adres
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nie pamiętasz hasła?"
      subtitle="Podaj adres e-mail powiązany z kontem, a wyślemy link do ustawienia nowego hasła."
      footer={
        <Link component={RouterLink} to="/login" underline="hover" variant="body2">
          Wróć do logowania
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.5}>
          {error ? (
            <Alert severity="error" sx={{ borderRadius: '16px' }}>
              {error}
            </Alert>
          ) : null}

          <TextField
            label="Adres e-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
            fullWidth
            disabled={submitting}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={submitting || !email}
            sx={{ borderRadius: '999px', py: 1.4 }}
            startIcon={
              submitting ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {submitting ? 'Wysyłanie…' : 'Wyślij link'}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
