import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { radii } from '../../theme';
import { usePanelT } from '../../i18n/panel';

interface MenuStarterProps {
  /** The four categories the one-click layout makes, in the menu's language. */
  names: readonly string[];
  busy: boolean;
  onStart: () => void;
  onCustom: () => void;
}

/**
 * What an empty menu shows instead of a blank board: the typical skeleton,
 * created in one click, so the first thing a new owner does is fill in dishes
 * rather than decide how a menu is organised.
 *
 * The names are menu content, not panel text: they are created in the menu's
 * own language (its starter texts), whichever language the panel is in.
 */
export function MenuStarter({ names, busy, onStart, onCustom }: MenuStarterProps) {
  const { t } = usePanelT();
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
          { label: names[0], left: 0, top: 0, rotate: -8 },
          { label: names[2], left: 128, top: 12, rotate: 7 },
          { label: names[3], left: 18, top: 78, rotate: 4 },
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
        {t('starter.title')}
      </Typography>
      <Typography
        variant="body1"
        color="textSecondary"
        sx={{ mt: 1, maxWidth: 460, mx: 'auto' }}
      >
        {t('starter.body')}
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
          {busy ? t('starter.creating') : t('starter.create')}
        </Button>
        <Button size="large" onClick={onCustom} disabled={busy}>
          {t('starter.custom')}
        </Button>
      </Stack>
      <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 2 }}>
        {names.join(' · ')}
      </Typography>
    </Paper>
  );
}
