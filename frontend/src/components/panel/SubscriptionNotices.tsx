import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import { alpha } from '@mui/material/styles';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';

/**
 * Full-content paywall shown in place of the dashboard when the restaurant's
 * subscription is blocked/expired. Owner cannot reach the menu builder,
 * settings or QR tools until they pay.
 */
export function SubscriptionPaywall({ onPay }: { onPay: () => void }) {
  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          maxWidth: 460,
          width: '100%',
          borderRadius: '24px',
          p: { xs: 3, sm: 5 },
          textAlign: 'center',
        }}
      >
        <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: (t) => alpha(t.palette.error.main, 0.12),
              color: 'error.main',
            }}
          >
            <LockRoundedIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h5" component="h1">
            Twoja subskrypcja wygasła
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Opłać zaległości, aby odblokować menu.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<CreditCardRoundedIcon />}
            onClick={onPay}
            sx={{ mt: 1 }}
          >
            Opłać subskrypcję
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

/**
 * Persistent banner shown above the dashboard while the restaurant is pending.
 * The owner can still build their menu; it just isn't publicly visible yet.
 */
export function SubscriptionPendingBanner({ onActivate }: { onActivate: () => void }) {
  return (
    <Paper
      elevation={0}
      role="status"
      sx={{
        mb: 3,
        borderRadius: 3,
        p: 2,
        bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
        border: '1px solid',
        borderColor: (t) => alpha(t.palette.warning.main, 0.4),
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <WarningAmberRoundedIcon sx={{ color: 'warning.dark', flexShrink: 0 }} />
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
          Twoje menu nie jest jeszcze publicznie widoczne. Opłać subskrypcję, aby
          aktywować kody QR.
        </Typography>
        <Button
          variant="contained"
          color="warning"
          size="small"
          onClick={onActivate}
          sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          Aktywuj subskrypcję
        </Button>
      </Stack>
    </Paper>
  );
}
