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
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogoutButton } from '../auth/LogoutButton';
import { Wordmark } from '../brand/Wordmark';
import { BottomNav } from './BottomNav';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { getAdminSession } from '../../services/authStorage';

const DRAWER_WIDTH = 264;

const NAV_ITEMS = [
  {
    label: 'Restauratorzy',
    short: 'Restauratorzy',
    to: '/admin/restaurants',
    icon: <StorefrontRoundedIcon />,
  },
  { label: 'Zespół HQ', short: 'Zespół', to: '/admin/team', icon: <GroupsRoundedIcon /> },
  {
    label: 'Dziennik zdarzeń',
    short: 'Dziennik',
    to: '/admin/logs',
    icon: <HistoryRoundedIcon />,
  },
];

/** Application shell: translucent top bar + permanent navigation drawer. */
export function AdminLayout() {
  const location = useLocation();
  const profile = useAdminProfile();

  // Falls back to what sign-in stored, so the header never flashes empty while
  // the live check is in flight.
  const adminEmail = profile.data?.email ?? getAdminSession()?.email ?? '';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
                <Wordmark size={19} color="text.primary" />
                <Typography
                  variant="subtitle2"
                  color="textSecondary"
                  sx={{ letterSpacing: '0.04em' }}
                >
                  Admin
                </Typography>
              </Stack>
              <Typography variant="caption" color="textSecondary">
                {adminEmail || 'Panel administracyjny platformy'}
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <LogoutButton scope="admin" />
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
          },
        }}
      >
        <Toolbar />
        <List sx={{ pt: 2 }}>
          {NAV_ITEMS.map((item) => {
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
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: 'inherit' },
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
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, md: 4 },
          pb: 'calc(var(--bottom-nav, 0px) + 48px)',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      <BottomNav
        label="Nawigacja HQ"
        items={NAV_ITEMS.map(({ short, to, icon }) => ({ label: short, to, icon }))}
      />
    </Box>
  );
}
