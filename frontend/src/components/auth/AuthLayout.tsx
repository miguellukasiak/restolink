import { useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Wordmark } from '../brand/Wordmark';
import { PanelLanguageSwitch } from '../panel/PanelLanguageSwitch';
import {
  BUILT_IN_PANEL_LANGUAGES,
  isPanelLanguage,
  setPanelLanguage,
  usePanelT,
} from '../../i18n/panel';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Links below the card — "forgot password", "back to sign in", etc. */
  footer?: ReactNode;
  /**
   * Offer the owner panel's languages. Off for the HQ door, whose panel is
   * Polish only.
   */
  languageSwitch?: boolean;
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
 *
 * Before sign-in nobody knows which restaurant this is, so the switch offers
 * the hand-written panel languages, and the language an email link carries
 * (`?lang=`, the one the email was written in) or this device last used, so
 * the page continues in it.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  languageSwitch = true,
}: AuthLayoutProps) {
  const [searchParams] = useSearchParams();
  const linkLanguage = searchParams.get('lang');
  const { i18n } = usePanelT();
  // The hand-written languages, plus the one an email link brought or this
  // device last used — a DeepL language nobody would find in a full list.
  const offered = [
    ...new Set([...BUILT_IN_PANEL_LANGUAGES, i18n.language, linkLanguage ?? '']),
  ].filter(isPanelLanguage);

  useEffect(() => {
    if (languageSwitch && isPanelLanguage(linkLanguage)) setPanelLanguage(linkLanguage);
  }, [languageSwitch, linkLanguage]);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 6,
        bgcolor: 'background.default',
        position: 'relative',
      }}
    >
      {languageSwitch ? (
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <PanelLanguageSwitch languages={offered} />
        </Box>
      ) : null}

      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Stack sx={{ mb: 3, alignItems: 'center' }}>
          <Wordmark size={30} color="text.primary" />
        </Stack>

        <Card sx={{ borderRadius: '28px' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
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
