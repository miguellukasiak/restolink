import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Links below the card — "forgot password", "back to sign in", etc. */
  footer?: ReactNode;
}

/**
 * Shared shell for every credential screen: a centred Material 3 card on a
 * tonal background, with the brand mark above it.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 6,
        background: `linear-gradient(180deg, ${alpha(
          theme.palette.primary.main,
          0.08,
        )} 0%, ${theme.palette.background.default} 55%)`,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Stack spacing={1.5} sx={{ mb: 3, alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={{
              width: 52,
              height: 52,
              display: 'grid',
              placeItems: 'center',
              // A string keeps this in pixels. `borderRadius: 999` would be a
              // multiplier against theme.shape.borderRadius, not a pill.
              borderRadius: '18px',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            R
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            RestoLink
          </Typography>
        </Stack>

        <Card sx={{ borderRadius: '28px' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {subtitle}
            </Typography>
            {children}
          </CardContent>
        </Card>

        {footer ? (
          <Box sx={{ mt: 2.5, textAlign: 'center' }}>{footer}</Box>
        ) : null}
      </Box>
    </Box>
  );
}
