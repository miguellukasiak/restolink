import type { ReactElement } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import GlobalStyles from '@mui/material/GlobalStyles';
import { alpha } from '@mui/material/styles';
import { NavLink, useLocation } from 'react-router-dom';
import { radii } from '../../theme';

export interface NavDestination {
  label: string;
  to: string;
  icon: ReactElement;
}

/** The bar's own height; the phone's home-indicator area comes on top. */
const BAR_HEIGHT = 72;

/**
 * The panel's sections on a phone or a small tablet, where the side drawer
 * does not fit (below `md`): a Material 3 navigation bar across the bottom,
 * every section in sight and in reach of a thumb. Without it the drawer
 * simply vanished and an owner on a phone was left in the menu builder.
 *
 * While it is shown, `--bottom-nav` on the root holds the height it covers,
 * so anything pinned to the bottom of the screen (the snackbar, a sticky
 * save bar, the page's own end) sits above it: `calc(var(--bottom-nav,
 * 0px) + …)`. The variable is 0 from `md` up and unset outside the panels.
 */
export function BottomNav({
  items,
  label,
  color = 'primary',
}: {
  items: NavDestination[];
  /** Names the landmark for screen readers. */
  label: string;
  color?: 'primary' | 'secondary';
}) {
  const location = useLocation();
  const current = items.find((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <GlobalStyles
        styles={(theme) => ({
          ':root': {
            '--bottom-nav': `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
            [theme.breakpoints.up('md')]: { '--bottom-nav': '0px' },
          },
        })}
      />
      <Paper
        component="nav"
        aria-label={label}
        data-bottom-nav
        square
        elevation={0}
        sx={{
          display: { md: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 'appBar',
          borderTop: 1,
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <BottomNavigation
          showLabels
          value={current?.to ?? false}
          sx={{
            height: BAR_HEIGHT,
            bgcolor: 'transparent',
            '& .MuiBottomNavigationAction-root': {
              // Five sections share a 360px phone; MUI's 80px minimum
              // would push the last one off the screen.
              minWidth: 0,
              px: 0.25,
              gap: 0.5,
              '&.Mui-selected': { color: `${color}.dark` },
            },
            '& .MuiBottomNavigationAction-label': {
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
              // The same size selected or not, so the row does not jump; a
              // point smaller on the narrowest phones, where "Languages"
              // would otherwise lose its last letters.
              '&, &.Mui-selected': {
                fontSize: '0.75rem',
                '@media (max-width: 359.95px)': { fontSize: '0.6875rem' },
              },
            },
            '& .nav-indicator': {
              display: 'grid',
              placeItems: 'center',
              width: 56,
              height: 32,
              borderRadius: radii.pill,
              transition: (theme) => theme.transitions.create('background-color'),
            },
            '& .Mui-selected .nav-indicator': {
              bgcolor: (theme) => alpha(theme.palette[color].main, 0.14),
            },
          }}
        >
          {items.map((item) => (
            <BottomNavigationAction
              key={item.to}
              value={item.to}
              label={item.label}
              icon={<Box className="nav-indicator">{item.icon}</Box>}
              component={NavLink}
              to={item.to}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </>
  );
}
