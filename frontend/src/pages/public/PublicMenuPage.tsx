import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import CssBaseline from '@mui/material/CssBaseline';
import { alpha } from '@mui/material/styles';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import type { PublicMenuItem } from '../../types';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { getApiErrorMessage } from '../../services/api';
import { resolveAccessState } from '../../constants/subscription';
import { PublicMenuView } from '../../components/public/PublicMenuView';
import { PublicMenuSkeleton } from '../../components/public/PublicMenuSkeleton';
import { ItemDetailModal } from '../../components/public/ItemDetailModal';

/** Clean, centered status screen shown when the menu isn't publicly available. */
function StatusScreen({
  icon,
  message,
}: {
  icon: 'blocked' | 'pending';
  message: string;
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        textAlign: 'center',
      }}
    >
      <Stack spacing={2.5} sx={{ alignItems: 'center', maxWidth: 420 }}>
        <Avatar
          sx={{
            width: 72,
            height: 72,
            bgcolor: (t) =>
              alpha(
                icon === 'blocked' ? t.palette.text.primary : t.palette.warning.main,
                0.1,
              ),
            color: icon === 'blocked' ? 'text.secondary' : 'warning.dark',
          }}
        >
          {icon === 'blocked' ? (
            <LockRoundedIcon sx={{ fontSize: 36 }} />
          ) : (
            <HourglassTopRoundedIcon sx={{ fontSize: 36 }} />
          )}
        </Avatar>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          {message}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * Public client menu route (`/menu/:restaurantId`). Data + modal orchestration
 * around the shared PublicMenuView (also reused by the settings live preview).
 */
export function PublicMenuPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { t } = useTranslation();
  const menu = usePublicMenu(restaurantId);

  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const restaurantName = menu.data?.restaurant.name ?? '';

  useEffect(() => {
    if (restaurantName) document.title = `${restaurantName} — Menu`;
  }, [restaurantName]);

  const openDetail = (item: PublicMenuItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  // Gate the menu on the restaurant's subscription status (blocked/pending/active).
  const access = menu.data
    ? resolveAccessState(
        menu.data.restaurant.status,
        menu.data.restaurant.subscription_valid_until,
      )
    : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />

      {menu.isLoading && <PublicMenuSkeleton />}

      {menu.isError && (
        <Box sx={{ maxWidth: 960, mx: 'auto', px: 2 }}>
          <Alert
            severity="error"
            sx={{ mt: 3 }}
            action={
              <Button color="inherit" size="small" onClick={() => void menu.refetch()}>
                {t('retry')}
              </Button>
            }
          >
            {getApiErrorMessage(menu.error)}
          </Alert>
        </Box>
      )}

      {access === 'BLOCKED' && (
        <StatusScreen icon="blocked" message="Menu chwilowo niedostępne." />
      )}

      {access === 'PENDING' && (
        <StatusScreen
          icon="pending"
          message="Restauracja w przygotowaniu. Zapraszamy wkrótce!"
        />
      )}

      {access === 'ACTIVE' && menu.data && (
        <>
          <PublicMenuView
            restaurantName={menu.data.restaurant.name}
            logoUrl={menu.data.restaurant.theme.logo_url}
            categories={menu.data.categories}
            onOpenItem={openDetail}
          />
          <ItemDetailModal
            item={selectedItem}
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
          />
        </>
      )}
    </Box>
  );
}
