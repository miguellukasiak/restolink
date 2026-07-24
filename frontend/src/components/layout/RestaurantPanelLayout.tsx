import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useRestaurantInfo } from '../../hooks/useRestaurantInfo';
import { useAuth } from '../../hooks/useAuth';

const DRAWER_WIDTH = 272;

/**
 * Isolated shell for the restaurant owner ecosystem (`/panel/:restaurantId`).
 * Visually distinct from the admin: teal "secondary" tonal navigation with the
 * restaurant context pinned in the sidebar header.
 */
export function RestaurantPanelLayout() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const location = useLocation();
  const { role } = useAuth();
  const restaurant = useRestaurantInfo(restaurantId);

  const base = `/panel/${restaurantId}`;
  const navItems = [
    { label: 'Kreator menu', to: `${base}/menu`, icon: <MenuBookRoundedIcon /> },
    { label: 'Kody QR', to: `${base}/qr`, icon: <QrCode2RoundedIcon /> },
    { label: 'Ustawienia', to: `${base}/settings`, icon: <SettingsRoundedIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
              <RestaurantRoundedIcon fontSize="small" />
            </Avatar>
            <Box>
              {restaurant.isLoading ? (
                <Skeleton variant="text" width={160} height={24} />
              ) : (
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {restaurant.data?.name ?? 'Panel restauratora'}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Zarządzaj swoją restauracją
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            size="small"
            variant="outlined"
            color="secondary"
            label={`ID: ${restaurantId.slice(0, 8)}…`}
            sx={{ fontFamily: 'monospace', display: { xs: 'none', sm: 'inline-flex' } }}
          />
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
        <List sx={{ pt: 2 }}>
          {navItems.map((item) => {
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
                    '&:hover': { bgcolor: (t) => alpha(t.palette.secondary.main, 0.22) },
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

        {role === 'ADMIN' && (
          <>
            <Box sx={{ flexGrow: 1 }} />
            <Divider sx={{ mx: 1 }} />
            <List sx={{ pb: 2 }}>
              <ListItemButton
                component={NavLink}
                to="/admin/restaurants"
                sx={{ borderRadius: 999 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <ArrowBackRoundedIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Panel admina"
                  slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                />
              </ListItemButton>
            </List>
          </>
        )}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 4 }, pb: 6 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
