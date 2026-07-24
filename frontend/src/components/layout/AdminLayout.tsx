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
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 264;

const NAV_ITEMS = [
  {
    label: 'Restauratorzy',
    to: '/admin/restaurants',
    icon: <StorefrontRoundedIcon />,
  },
];

/** Application shell: translucent top bar + permanent navigation drawer. */
export function AdminLayout() {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
              <RestaurantRoundedIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                HoReCa Admin
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Panel administracyjny platformy
              </Typography>
            </Box>
          </Stack>
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

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 4 }, pb: 6 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
