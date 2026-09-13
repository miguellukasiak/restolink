import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { getApiErrorMessage } from '../../services/api';
import { login } from '../../services/authService';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const session = await login(email.trim(), password);

      // `next` is only honoured when it is a path on this site. Following an
      // arbitrary value would turn the login screen into an open redirect that
      // a phishing link could point anywhere.
      const next = searchParams.get('next');
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

      navigate(safeNext ?? `/panel/${session.restaurantId}`, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Zaloguj się"
      subtitle="Wpisz dane dostępowe do panelu swojej restauracji."
      footer={
        <Typography variant="body2" color="text.secondary">
          Nie masz jeszcze konta?{' '}
          <Link component={RouterLink} to="/#kontakt" underline="hover">
            Skontaktuj się z nami
          </Link>
        </Typography>
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

          <TextField
            label="Hasło"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            fullWidth
            disabled={submitting}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((visible) => !visible)}
                      edge="end"
                      aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={submitting || !email || !password}
            sx={{ borderRadius: '999px', py: 1.4 }}
            startIcon={
              submitting ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {submitting ? 'Logowanie…' : 'Zaloguj się'}
          </Button>

          <Link
            component={RouterLink}
            to="/forgot-password"
            underline="hover"
            variant="body2"
            sx={{ textAlign: 'center' }}
          >
            Nie pamiętasz hasła?
          </Link>
        </Stack>
      </form>
    </AuthLayout>
  );
}
