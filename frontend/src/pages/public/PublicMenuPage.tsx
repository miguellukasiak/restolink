import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import CssBaseline from '@mui/material/CssBaseline';
import type { PublicMenuItem } from '../../types';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { getApiErrorMessage } from '../../services/api';
import { PublicMenuView } from '../../components/public/PublicMenuView';
import { ItemDetailModal } from '../../components/public/ItemDetailModal';

/** Loading skeleton mirroring the final layout. */
function PublicMenuSkeleton() {
  return (
    <Stack spacing={3} sx={{ px: 2, pt: 3, maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Skeleton variant="circular" width={56} height={56} />
        <Skeleton variant="rounded" height={48} sx={{ flex: 1, borderRadius: 999 }} />
      </Stack>
      <Stack direction="row" spacing={2}>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} variant="circular" width={56} height={56} />
        ))}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 2,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <Skeleton key={key} variant="rounded" height={180} sx={{ borderRadius: 4 }} />
        ))}
      </Box>
    </Stack>
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

      {menu.data && (
        <PublicMenuView
          restaurantName={menu.data.restaurant.name}
          logoUrl={menu.data.restaurant.theme.logo_url}
          categories={menu.data.categories}
          onOpenItem={openDetail}
        />
      )}

      <ItemDetailModal
        item={selectedItem}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </Box>
  );
}
