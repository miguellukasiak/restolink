import { useEffect, useMemo } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useRestaurantInfo } from '../../hooks/useRestaurantInfo';
import { useCheckout, useCheckoutReturn } from '../../hooks/useSubscription';
import { getApiErrorMessage } from '../../services/api';
import { LogoutButton } from '../auth/LogoutButton';
import { Wordmark } from '../brand/Wordmark';
import { ImpersonationBanner } from '../panel/ImpersonationBanner';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { resolveAccessState } from '../../constants/subscription';
import { PanelLanguageSwitch } from '../panel/PanelLanguageSwitch';
import {
  PANEL_DEFAULT_LANGUAGE,
  isPanelLanguage,
  panelLanguage,
  setPanelLanguage,
  usePanelT,
  type PanelLanguage,
} from '../../i18n/panel';
import {
  SubscriptionPaywall,
  SubscriptionPendingBanner,
} from '../panel/SubscriptionNotices';

const DRAWER_WIDTH = 272;

/**
 * Isolated shell for the restaurant owner ecosystem (`/panel/:restaurantId`).
 * Visually distinct from the admin: teal "secondary" tonal navigation with the
 * restaurant context pinned in the sidebar header.
 */
export function RestaurantPanelLayout() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const location = useLocation();
  const restaurant = useRestaurantInfo(restaurantId);
  const { showInfo, showSuccess, showError } = useSnackbar();
  const checkout = useCheckout();
  const { t } = usePanelT();

  // English for everyone, plus the one language HQ gave this restaurant. A
  // choice remembered on this device from another restaurant, or one HQ has
  // since taken away, falls back to English.
  const secondLanguage = restaurant.data?.panel_language;
  const panelLanguages = useMemo(
    () =>
      isPanelLanguage(secondLanguage) && secondLanguage !== PANEL_DEFAULT_LANGUAGE
        ? ([PANEL_DEFAULT_LANGUAGE, secondLanguage] as PanelLanguage[])
        : [PANEL_DEFAULT_LANGUAGE],
    [secondLanguage],
  );
  useEffect(() => {
    if (!restaurant.data) return;
    if (!panelLanguages.includes(panelLanguage()))
      setPanelLanguage(PANEL_DEFAULT_LANGUAGE);
  }, [restaurant.data, panelLanguages]);

  // Access is only enforced once the restaurant details have loaded.
  const access = restaurant.data
    ? resolveAccessState(restaurant.data.status, restaurant.data.subscription_valid_until)
    : null;

  // Returning from Stripe: re-read the restaurant so the banner reflects the
  // new status without a manual refresh. The webhook can land after the
  // redirect, so `confirming` covers the seconds in between.
  const { outcome, confirming } = useCheckoutReturn(restaurantId, access === 'ACTIVE');

  useEffect(() => {
    if (outcome === 'success') {
      showSuccess(t('billing.paid'));
    } else if (outcome === 'cancelled') {
      showInfo(t('billing.cancelled'));
    }
  }, [outcome, showSuccess, showInfo, t]);

  const handlePaymentCta = async () => {
    try {
      // On success this navigates to Stripe, so nothing after it runs.
      await checkout.mutateAsync();
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  };

  const base = `/panel/${restaurantId}`;
  // In the order an owner sets up: write the menu, dress it, print its codes.
  // Everything else is an extra and sits below the divider.
  const navGroups = [
    [
      { label: t('nav.builder'), to: `${base}/menu`, icon: <MenuBookRoundedIcon /> },
      {
        label: t('nav.appearance'),
        to: `${base}/settings`,
        icon: <PaletteRoundedIcon />,
      },
      { label: t('nav.qr'), to: `${base}/qr`, icon: <QrCode2RoundedIcon /> },
    ],
    [
      {
        label: t('nav.languages'),
        to: `${base}/dictionary`,
        icon: <TranslateRoundedIcon />,
      },
      { label: t('nav.reviews'), to: `${base}/google`, icon: <StarRoundedIcon /> },
    ],
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {/* The wordmark stands where the brand tile did, so the owner's
                own restaurant name keeps the prominence it had — demoting it
                to make room for ours would be the wrong trade on the screen
                they work in all day. */}
            <Wordmark size={18} color="text.primary" />
            <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />
            <Box>
              {restaurant.isLoading ? (
                <Skeleton variant="text" width={160} height={24} />
              ) : (
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {restaurant.data?.name ?? t('nav.ownerPanel')}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {t('nav.tagline')}
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ mr: { xs: 1, sm: 2 } }}>
            <PanelLanguageSwitch languages={panelLanguages} />
          </Box>
          <Chip
            size="small"
            variant="outlined"
            color="secondary"
            label={`ID: ${restaurantId.slice(0, 8)}…`}
            sx={{ fontFamily: 'monospace', display: { xs: 'none', sm: 'inline-flex' } }}
          />
          <LogoutButton scope="restaurant" />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            bgcolor: 'transparent',
            px: 2,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Toolbar />
        {navGroups.map((items, groupIndex) => (
          <List key={groupIndex} sx={{ pt: groupIndex === 0 ? 2 : 1 }}>
            {groupIndex > 0 && <Divider sx={{ mx: 2, mb: 1.5 }} />}
            {items.map((item) => {
              const selected = location.pathname.startsWith(item.to);
              return (
                <ListItemButton
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  selected={selected}
                  sx={{
                    borderRadius: 999,
                    mb: 0.5,
                    '&.Mui-selected': {
                      bgcolor: (t) => alpha(t.palette.secondary.main, 0.14),
                      color: 'secondary.dark',
                      '&:hover': {
                        bgcolor: (t) => alpha(t.palette.secondary.main, 0.22),
                      },
                      '& .MuiListItemIcon-root': { color: 'secondary.dark' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 4 }, pb: 6 }}
      >
        <Toolbar />
        {/* Above the subscription gate on purpose: an admin looking at a
            blocked restaurant still needs to know whose panel this is. */}
        <ImpersonationBanner />
        {access === 'BLOCKED' ? (
          // Expired/blocked: no access to builder, settings or QR tools.
          <SubscriptionPaywall
            onPay={() => void handlePaymentCta()}
            loading={checkout.isPending}
          />
        ) : (
          <>
            {access === 'PENDING' && (
              <SubscriptionPendingBanner
                onActivate={() => void handlePaymentCta()}
                loading={checkout.isPending}
                confirming={confirming}
              />
            )}
            <Outlet />
          </>
        )}
      </Box>
    </Box>
  );
}
