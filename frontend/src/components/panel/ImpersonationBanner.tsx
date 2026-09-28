import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import { clearRestaurantSession, getRestaurantSession } from '../../services/authStorage';

/**
 * The strip shown while HQ is inside a customer's panel.
 *
 * The support token is a real owner token — the server cannot tell it apart
 * from a genuine sign-in, which is precisely why the interface has to. Without
 * this, an admin who steps away and comes back is looking at a panel that
 * claims to be theirs, and the next thing they edit belongs to someone else.
 *
 * Renders nothing for an ordinary owner, so the layout can mount it
 * unconditionally.
 */
export function ImpersonationBanner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = getRestaurantSession();

  if (!session?.impersonated) return null;

  function leave() {
    // Only the borrowed session goes; the admin session lives under its own
    // key and is what makes the way back to HQ work.
    clearRestaurantSession();
    queryClient.clear();
    navigate('/admin/restaurants', { replace: true });
  }

  return (
    <Alert
      severity="warning"
      variant="filled"
      sx={{ mb: 2, borderRadius: '12px' }}
      action={
        <Button color="inherit" size="small" onClick={leave}>
          Wróć do HQ
        </Button>
      }
    >
      <AlertTitle sx={{ mb: 0.25 }}>Tryb wsparcia</AlertTitle>
      Oglądasz panel restauracji {session.restaurantName} jako administrator.
      Wszystko, co tu zmienisz, zmieni się u restauratora. Sesja wygasa po
      godzinie, a wejście zostało zapisane w dzienniku zdarzeń.
    </Alert>
  );
}
