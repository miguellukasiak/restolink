import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { getApiErrorMessage } from '../../services/api';
import { adminLogin, NotASuperadminError } from '../../services/authService';

/** Was this "you are not an admin" rather than "those credentials are wrong"? */
function isAccessDenied(error: unknown): boolean {
  if (error instanceof NotASuperadminError) return true;
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 403;
}

/**
 * The HQ door.
 *
 * Unlisted rather than secret — nothing here is protected by the URL being
 * hard to guess. It used to accept a single shared `SUPERADMIN_PASSWORD`;
 * access is now an individual account in `admin_user` carrying the
 * `is_superadmin` flag, so it can be granted and revoked per person and the
 * logs can say who did what.
 *
 * Two outcomes worth separating. Credentials that match nothing get the usual
 * "wrong email or password". Credentials that are *right* but belong to a
 * restaurant owner — the most likely way to end up on this page by mistake —
 * get told so, and pointed at the door they actually want.
 */
export function HqAccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDenied(false);
    setSubmitting(true);

    try {
      await adminLogin(email, password);

      const next = searchParams.get('next');
      const safeNext =
        next && next.startsWith('/admin') && !next.startsWith('//') ? next : null;

      navigate(safeNext ?? '/admin/restaurants', { replace: true });
    } catch (err) {
      setDenied(isAccessDenied(err));
      setError(getApiErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      languageSwitch={false}
      title="Dostęp serwisowy"
      subtitle="Ta strona jest przeznaczona wyłącznie dla administratorów RestoLink."
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.5}>
          {error ? (
            <Alert severity={denied ? 'warning' : 'error'} sx={{ borderRadius: '16px' }}>
              {error}
              {denied ? (
                // Phrased as a condition, not a claim. The same 403 covers two
                // different people — a restaurant owner who bookmarked the
                // wrong door, and an HQ account whose access was revoked — and
                // the server deliberately does not say which, so asserting
                // "this is an owner account" would be wrong half the time.
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Jeśli prowadzisz restaurację,{' '}
                  <Link component={RouterLink} to="/login">
                    zaloguj się w panelu restauracji
                  </Link>
                  .
                </Typography>
              ) : null}
            </Alert>
          ) : null}

          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            fullWidth
            disabled={submitting}
          />

          <TextField
            label="Hasło"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            fullWidth
            disabled={submitting}
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
            {submitting ? 'Weryfikacja…' : 'Wejdź'}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
