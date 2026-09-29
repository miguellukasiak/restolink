import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

/** A round, brand-tinted badge for an icon: the panel's dialog and card headers. */
export function TonalIcon({
  children,
  size = 44,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
        color: 'primary.main',
      }}
    >
      {children}
    </Box>
  );
}
