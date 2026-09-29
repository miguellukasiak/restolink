import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { STARTER_CATEGORIES } from '../../constants/menu';
import { radii } from '../../theme';

interface MenuStarterProps {
  busy: boolean;
  onStart: () => void;
  onCustom: () => void;
}

/**
 * What an empty menu shows instead of a blank board: the typical skeleton,
 * created in one click, so the first thing a new owner does is fill in dishes
 * rather than decide how a menu is organised.
 */
export function MenuStarter({ busy, onStart, onCustom }: MenuStarterProps) {
  return (
    <Paper
      elevation={1}
      sx={{
        borderRadius: radii.lg,
        px: { xs: 3, sm: 6 },
        py: { xs: 5, sm: 7 },
        textAlign: 'center',
        backgroundImage: (t) =>
          `radial-gradient(120% 80% at 50% 0%, ${alpha(t.palette.primary.main, 0.08)}, transparent 60%)`,
      }}
    >
      {/* A stack of category "tabs" fanned over a menu card. */}
      <Box
        sx={{ position: 'relative', width: 200, height: 112, mx: 'auto', mb: 3 }}
        aria-hidden
      >
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: 8,
            transform: 'translateX(-50%)',
            width: 88,
            height: 88,
            borderRadius: radii.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: (t) => `0 16px 32px ${alpha(t.palette.primary.main, 0.35)}`,
          }}
        >
          <MenuBookRoundedIcon sx={{ fontSize: 44 }} />
        </Box>
        {[
          { label: 'Przystawki', left: 0, top: 0, rotate: -8 },
          { label: 'Desery', left: 128, top: 12, rotate: 7 },
          { label: 'Napoje', left: 18, top: 78, rotate: 4 },
        ].map((tab) => (
          <Box
            key={tab.label}
            sx={{
              position: 'absolute',
              left: tab.left,
              top: tab.top,
              transform: `rotate(${tab.rotate}deg)`,
              px: 1.25,
              py: 0.5,
              borderRadius: radii.pill,
              bgcolor: 'background.paper',
              boxShadow: '0 6px 16px rgba(22, 28, 37, 0.12)',
              fontSize: 12,
              fontWeight: 700,
              color: 'text.primary',
            }}
          >
            {tab.label}
          </Box>
        ))}
      </Box>

      <Typography variant="h5" component="h2">
        Zacznijmy od kategorii
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mt: 1, maxWidth: 460, mx: 'auto' }}
      >
        Kategorie to działy Twojego menu. Utwórz typowy układ jednym kliknięciem — nazwy
        zmienisz w każdej chwili.
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mt: 3.5, justifyContent: 'center', alignItems: 'center' }}
      >
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          disabled={busy}
          startIcon={
            busy ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <AutoAwesomeRoundedIcon />
            )
          }
        >
          {busy ? 'Tworzę kategorie…' : 'Utwórz podstawowy układ'}
        </Button>
        <Button size="large" onClick={onCustom} disabled={busy}>
          Własna kategoria
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
        {STARTER_CATEGORIES.join(' · ')}
      </Typography>
    </Paper>
  );
}
