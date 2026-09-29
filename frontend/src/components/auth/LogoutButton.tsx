import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useQueryClient } from '@tanstack/react-query';
import { clearAdminSession, clearRestaurantSession } from '../../services/authStorage';
import { usePanelT } from '../../i18n/panel';

interface LogoutButtonProps {
  scope: 'restaurant' | 'admin';
}

/**
 * Signs out of one session.
 *
 * The React Query cache is cleared as well: it still holds the previous
 * account's menu and restaurant list, and leaving it in place would show that
 * data for a moment to whoever signs in next on a shared device.
 */
export function LogoutButton({ scope }: LogoutButtonProps) {
  const { t } = usePanelT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function handleLogout() {
    if (scope === 'admin') {
      clearAdminSession();
    } else {
      clearRestaurantSession();
    }
    queryClient.clear();
    navigate(scope === 'admin' ? '/hq-access' : '/login', { replace: true });
  }

  return (
    <Button
      onClick={handleLogout}
      color="inherit"
      size="small"
      startIcon={<LogoutRoundedIcon fontSize="small" />}
      sx={{ borderRadius: '999px', ml: 1 }}
    >
      {/* HQ reads Polish; the owner panel follows its own language. */}
      {scope === 'admin' ? 'Wyloguj' : t('nav.logout')}
    </Button>
  );
}
