import { forwardRef, useEffect, useState } from 'react';
import type { ReactElement, Ref } from 'react';
import Dialog from '@mui/material/Dialog';
import Slide from '@mui/material/Slide';
import type { TransitionProps } from '@mui/material/transitions';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { getAllergenIcon } from '../../constants/menuIcons';

const SlideUp = forwardRef(function SlideUp(
  props: TransitionProps & { children: ReactElement },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface AllergyGateModalProps {
  open: boolean;
  /** 'welcome' = first-visit gate; 'edit' = re-opened from the header icon. */
  mode: 'welcome' | 'edit';
  /** Unique allergens actually present in this restaurant's dishes. */
  allergens: string[];
  /** Currently excluded allergens (the modal starts from these). */
  initialSelected: string[];
  /** Commit the chosen exclusions (also marks the prompt answered). */
  onApply: (selected: string[]) => void;
  /** Welcome-mode "Nie, pokaż menu" — answered, no filters. */
  onSkip: () => void;
  /** Dismiss (X / backdrop / Esc). */
  onClose: () => void;
}

/**
 * Uber-style allergy gate: a friendly bottom-sheet (mobile) / dialog (desktop)
 * where a guest picks the allergens they want hidden from the menu. Shown once
 * on first visit (welcome) and re-openable any time from the header to edit.
 */
export function AllergyGateModal({
  open,
  mode,
  allergens,
  initialSelected,
  onApply,
  onSkip,
  onClose,
}: AllergyGateModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selected, setSelected] = useState<string[]>(initialSelected);

  // Re-seed the local selection from the committed one each time the sheet
  // opens (or the committed set changes), so re-opening always reflects reality.
  const initialKey = initialSelected.join('|');
  useEffect(() => {
    if (open) setSelected(initialSelected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  const toggle = (allergen: string) =>
    setSelected((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen],
    );

  const isWelcome = mode === 'welcome';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slots={isMobile ? { transition: SlideUp } : undefined}
      aria-labelledby="allergy-gate-title"
      slotProps={{
        paper: {
          sx: isMobile
            ? {
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                m: 0,
                width: '100%',
                maxWidth: '100%',
                borderRadius: '28px 28px 0 0',
              }
            : { borderRadius: '28px' },
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', mb: 1 }}>
          <Avatar
            sx={{
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: 'primary.main',
              width: 48,
              height: 48,
            }}
          >
            <HealthAndSafetyRoundedIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              component="h2"
              id="allergy-gate-title"
              sx={{ fontWeight: 700, lineHeight: 1.25 }}
            >
              {isWelcome ? 'Czy masz jakieś alergie pokarmowe?' : 'Filtruj alergeny'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {isWelcome
                ? 'Zaznacz składniki, których chcesz unikać — ukryjemy dania, które je zawierają.'
                : 'Zaznacz alergeny, których dania mają być ukryte w menu.'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Zamknij" edge="end" sx={{ mt: -0.5 }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        {/* Selectable allergen chips (icon + label; filled when excluded). */}
        <Box
          role="group"
          aria-label="Alergeny do wykluczenia"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 2.5 }}
        >
          {allergens.map((allergen) => {
            const active = selected.includes(allergen);
            return (
              <Chip
                key={allergen}
                clickable
                onClick={() => toggle(allergen)}
                aria-pressed={active}
                icon={active ? <CheckRoundedIcon /> : getAllergenIcon(allergen)}
                label={allergen}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 600,
                  ...(active
                    ? {}
                    : {
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
                        borderColor: 'divider',
                      }),
                }}
              />
            );
          })}
        </Box>

        {/* Footer actions adapt to mode + whether anything is selected. */}
        {isWelcome ? (
          <Stack spacing={1}>
            {selected.length > 0 && (
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="primary"
                startIcon={<HealthAndSafetyRoundedIcon />}
                onClick={() => onApply(selected)}
              >
                {`Zastosuj filtry (${selected.length})`}
              </Button>
            )}
            <Button
              fullWidth
              size="large"
              variant={selected.length > 0 ? 'text' : 'contained'}
              color="secondary"
              onClick={onSkip}
            >
              Nie, pokaż menu
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              size="large"
              variant="text"
              color="inherit"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
            >
              Wyczyść
            </Button>
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="primary"
              startIcon={<HealthAndSafetyRoundedIcon />}
              onClick={() => onApply(selected)}
            >
              Zastosuj filtry
            </Button>
          </Stack>
        )}
      </Box>
    </Dialog>
  );
}
