import { useMemo } from 'react';
import type { Ref } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { MenuCategory, MenuNote, PublicMenuResponse } from '../../types';
import { createRestaurantTheme } from '../public/RestaurantThemeProvider';
import { PublicMenuView } from '../public/PublicMenuView';
import { MenuSkeleton } from '../public/MenuSkeleton';
import { PhoneFrame } from './PhoneFrame';
import { EmptyMenuPreview } from './EmptyMenuPreview';
import { GuestPreviewLanguage } from './GuestPreviewLanguage';
import { usePanelT } from '../../i18n/panel';

interface LiveMenuPreviewProps {
  restaurantId: string;
  /** The board as it is right now — including moves not yet saved. */
  categories: MenuCategory[];
  /** The board's notes, placed among the categories. */
  notes: MenuNote[];
  /** For the restaurant's name, logo and colours. */
  publicMenu: PublicMenuResponse | undefined;
  onOpenItem: (itemId: string) => void;
  scrollRef?: Ref<HTMLDivElement>;
  /** The phone's size, fitted to the space around it (useFittedPhone). */
  phone: { width: number; screenHeight: number };
  /** Shown as a close button in the header, when the preview is a dialog. */
  onClose?: () => void;
}

/**
 * The guest menu on a phone, fed from the builder's own state rather than the
 * saved menu, so a dragged dish or note, a flipped availability switch or a
 * renamed category shows up on the phone the moment it happens on the board.
 *
 * It is the real guest menu component under the restaurant's real theme. The
 * header (search, language, allergy filter) is inert here — the preview is for
 * looking, and a language switch in it would re-language the whole panel —
 * but the dishes are live: clicking one opens it in the editor.
 */
export function LiveMenuPreview({
  restaurantId,
  categories,
  notes,
  publicMenu,
  onOpenItem,
  scrollRef,
  phone,
  onClose,
}: LiveMenuPreviewProps) {
  const { t } = usePanelT();
  const theme = publicMenu?.restaurant.theme;
  const menuTheme = useMemo(
    () =>
      createRestaurantTheme({
        primary_color: theme?.primary_color,
        background_color: theme?.background_color,
        font_family: theme?.font_family,
        menu_pattern: theme?.menu_pattern,
      }),
    [
      theme?.primary_color,
      theme?.background_color,
      theme?.font_family,
      theme?.menu_pattern,
    ],
  );

  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
      <Stack
        direction="row"
        sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
          <Box
            aria-hidden
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              // The first frame is the plain dot, so a paused animation (a
              // hidden tab) still shows it — see CLAUDE.md, trap 7.
              '@keyframes live-pulse': {
                from: { boxShadow: '0 0 0 0 rgba(15, 130, 86, 0.45)' },
                to: { boxShadow: '0 0 0 8px rgba(15, 130, 86, 0)' },
              },
              animation: 'live-pulse 1.6s ease-out infinite',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
          <Typography variant="subtitle2">{t('preview.live')}</Typography>
        </Stack>
        <Button
          size="small"
          href={`/menu/${restaurantId}`}
          target="_blank"
          rel="noopener"
          endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '16px !important' }} />}
          sx={{ px: 1.5 }}
        >
          {t('common.open')}
        </Button>
        {onClose && (
          <IconButton aria-label={t('preview.close')} onClick={onClose} sx={{ ml: 0.5 }}>
            <CloseRoundedIcon />
          </IconButton>
        )}
      </Stack>

      <PhoneFrame
        address={`restolink.app/menu/${restaurantId.slice(0, 8)}…`}
        width={phone.width}
        screenHeight={phone.screenHeight}
        scrollRef={scrollRef}
        measureKey={Boolean(publicMenu)}
      >
        {publicMenu ? (
          <GuestPreviewLanguage>
            <ThemeProvider theme={menuTheme}>
              <Box
                sx={{
                  bgcolor: 'background.default',
                  // Stretched to the screen by PhoneFrame; the menu fills it,
                  // background pattern included.
                  display: 'flex',
                  flexDirection: 'column',
                  '& > *': { flexGrow: 1 },
                  '& header': { pointerEvents: 'none' },
                }}
              >
                <PublicMenuView
                  restaurantName={publicMenu.restaurant.name}
                  logoUrl={publicMenu.restaurant.theme.logo_url}
                  languages={publicMenu.restaurant.languages}
                  categories={categories}
                  notes={notes}
                  onOpenItem={(dish) => onOpenItem(dish.id)}
                  emptyState={<EmptyMenuPreview />}
                />
              </Box>
            </ThemeProvider>
          </GuestPreviewLanguage>
        ) : (
          <MenuSkeleton />
        )}
      </PhoneFrame>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        {t('preview.clickToEdit')}
      </Typography>
    </Stack>
  );
}
