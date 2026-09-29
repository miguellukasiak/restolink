import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { usePanelT } from '../../i18n/panel';
import { getApiErrorMessage } from '../../services/api';
import { resetPassword } from '../../services/authService';

/** Mirrors the backend's bounds so the user finds out before a round trip. */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function ResetPasswordPage() {
  const { t } = usePanelT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  // bcrypt hashes only the first 72 bytes, so the backend refuses anything
  // longer rather than silently ignoring the tail. Polish characters take two
  // bytes each, which is why this counts bytes and not characters.
  const tooLong = byteLength(password) > MAX_PASSWORD_BYTES;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit =
    !submitting && password.length >= MIN_PASSWORD_LENGTH && !tooLong && !mismatch && confirmation.length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        title={t('auth.invalidLink')}
        subtitle={t('reset.noTokenSubtitle')}
        footer={
          <Link component={RouterLink} to="/login" underline="hover" variant="body2">
            {t('auth.backToLogin')}
          </Link>
        }
      >
        <Stack spacing={2}>
          <Alert severity="warning" sx={{ borderRadius: '16px' }}>
            {t('reset.openExactly')}
          </Alert>
          <Button
            component={RouterLink}
            to="/forgot-password"
            variant="contained"
            sx={{ borderRadius: '999px', py: 1.2 }}
          >
            {t('reset.requestNew')}
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title={t('reset.doneTitle')}
        subtitle={t('reset.doneSubtitle')}
      >
        <Stack spacing={2}>
          <Alert severity="success" sx={{ borderRadius: '16px' }}>
            {t('reset.spent')}
          </Alert>
          <Alert severity="info" sx={{ borderRadius: '16px' }}>
            {t('reset.otherSessions')}
          </Alert>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => navigate('/login', { replace: true })}
            sx={{ borderRadius: '999px', py: 1.4 }}
          >
            {t('auth.goToLogin')}
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('reset.title')}
      subtitle={t('reset.subtitle')}
      footer={
        <Link component={RouterLink} to="/login" underline="hover" variant="body2">
          {t('auth.backToLogin')}
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
            label={t('reset.newPassword')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
            fullWidth
            disabled={submitting}
            error={tooShort || tooLong}
            helperText={
              tooLong
                ? t('auth.passwordTooLong', { max: MAX_PASSWORD_BYTES })
                : t('auth.passwordMin', { min: MIN_PASSWORD_LENGTH })
            }
          />

          <TextField
            label={t('reset.repeat')}
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="new-password"
            required
            fullWidth
            disabled={submitting}
            error={mismatch}
            helperText={mismatch ? t('auth.passwordMismatch') : ' '}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={!canSubmit}
            sx={{ borderRadius: '999px', py: 1.4 }}
            startIcon={
              submitting ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {submitting ? t('common.saving') : t('reset.submit')}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
