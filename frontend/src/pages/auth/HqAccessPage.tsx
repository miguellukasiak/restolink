import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { getApiErrorMessage } from '../../services/api';
import { adminLogin } from '../../services/authService';

/**
 * The super-admin door.
 *
 * Unlisted rather than secret — nothing here is protected by the URL being
 * hard to guess. The only credential is `SUPERADMIN_PASSWORD`, checked
 * server-side in constant time against an environment variable; there is no
 * admin row in the database to find, phish or leak in a dump.
 */
export function HqAccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await adminLogin(password);

      const next = searchParams.get('next');
      const safeNext =
        next && next.startsWith('/admin') && !next.startsWith('//') ? next : null;

      navigate(safeNext ?? '/admin/restaurants', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Dostęp serwisowy"
      subtitle="Ta strona jest przeznaczona wyłącznie dla administratora RestoLink."
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.5}>
          {error ? (
            <Alert severity="error" sx={{ borderRadius: '16px' }}>
              {error}
            </Alert>
          ) : null}

          <TextField
            label="Hasło administratora"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
            disabled={submitting || !password}
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
