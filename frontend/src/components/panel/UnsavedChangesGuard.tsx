import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { usePanelT } from '../../i18n/panel';

interface UnsavedChangesGuardProps {
  /** True while the page holds edits that are not saved. */
  when: boolean;
  /**
   * Saves the edits; resolves true when they were saved. Given, the dialog
   * offers "Save and continue" beside leaving without saving.
   */
  onSave?: () => Promise<boolean>;
}

/**
 * Asks before the owner leaves a page with unsaved edits.
 *
 * Moving to another panel tab (a nav link, the browser's back button) opens
 * the panel's own dialog: stay, leave without saving, or — where the page
 * can — save and go on. Closing or reloading the tab gets the browser's own
 * prompt, the only thing a page may show at that moment. Signing out is not
 * held up: it leaves the panel on purpose.
 */
export function UnsavedChangesGuard({ when, onSave }: UnsavedChangesGuardProps) {
  const { t } = usePanelT();
  const [saving, setSaving] = useState(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      nextLocation.pathname !== currentLocation.pathname &&
      nextLocation.pathname.startsWith('/panel/'),
  );

  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers show the prompt only when a value is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  const open = blocker.state === 'blocked';

  const saveAndContinue = async () => {
    if (!onSave) return;
    setSaving(true);
    const saved = await onSave();
    setSaving(false);
    // A failed save keeps the owner here, where the error and the form are.
    if (saved) blocker.proceed?.();
    else blocker.reset?.();
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : () => blocker.reset?.()}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { p: 1 } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14),
              color: 'warning.dark',
            }}
          >
            <WarningAmberRoundedIcon />
          </Avatar>
          {t('unsaved.title')}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ textAlign: 'center' }}>
          {t('unsaved.body')}
        </DialogContentText>
      </DialogContent>
      {/* One per row, the way forward first: three labels of this length
          never sit well side by side in a narrow dialog. */}
      <DialogActions
        sx={{
          px: 3,
          pb: 2,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 1,
          '& > :not(style) ~ :not(style)': { ml: 0 },
        }}
      >
        {onSave && (
          <Button
            variant="contained"
            onClick={() => void saveAndContinue()}
            disabled={saving}
            startIcon={
              saving ? <CircularProgress size={18} color="inherit" /> : undefined
            }
          >
            {t('unsaved.saveAndContinue')}
          </Button>
        )}
        <Button
          color="error"
          variant={onSave ? 'text' : 'contained'}
          onClick={() => blocker.proceed?.()}
          disabled={saving}
        >
          {t('unsaved.leave')}
        </Button>
        <Button color="inherit" onClick={() => blocker.reset?.()} disabled={saving}>
          {t('unsaved.stay')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
