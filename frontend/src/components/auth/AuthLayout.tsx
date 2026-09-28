import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Wordmark } from '../brand/Wordmark';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Links below the card — "forgot password", "back to sign in", etc. */
  footer?: ReactNode;
}

/**
 * Shared shell for every credential screen: a centred Material 3 card on a
 * neutral background, with the wordmark above it.
 *
 * The background used to be a gradient washed with the primary colour. It is
 * flat now: a tinted backdrop competes with the card it is meant to present,
 * and it was the single loudest piece of colour on the first screen anyone
 * sees. The green appears where it means something — the submit button and
 * the focused field — rather than behind everything.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 6,
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Stack sx={{ mb: 3, alignItems: 'center' }}>
          <Wordmark size={30} color="text.primary" />
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
