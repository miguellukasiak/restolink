import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import SmartphoneRoundedIcon from '@mui/icons-material/SmartphoneRounded';
import type { MenuNote, RestaurantThemeSettings } from '../../types';
import { NOTE_MAX_LENGTH, NOTE_TEMPLATES } from '../../constants/menu';
import { createRestaurantTheme } from '../public/RestaurantThemeProvider';
import { MenuNoteCard } from '../public/MenuNoteCard';
import { radii } from '../../theme';
import { usePanelT } from '../../i18n/panel';
import { TonalIcon } from './TonalIcon';

interface MenuNoteDialogProps {
  open: boolean;
  /** The note being edited; null writes a new one. */
  note: MenuNote | null;
  /** Where a new note lands — said in the dialog, so nobody hunts for it. */
  placement: 'start' | 'end';
  /** The restaurant's colours and font, for the preview. */
  menuTheme?: RestaurantThemeSettings;
  saving: boolean;
  onClose: () => void;
  onSave: (body: string) => void;
}

const TEMPLATE_BODIES: readonly string[] = NOTE_TEMPLATES.map(
  (template) => template.body,
);

/**
 * Writes or rewrites a note: the text, a few starting points for a new one,
 * and the note as guests will see it in the restaurant's own colours.
 */
export function MenuNoteDialog({
  open,
  note,
  placement,
  menuTheme,
  saving,
  onClose,
  onSave,
}: MenuNoteDialogProps) {
  const { t } = usePanelT();
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText(note?.body ?? '');
  }, [open, note]);

  const restaurantTheme = useMemo(
    () =>
      createRestaurantTheme({
        primary_color: menuTheme?.primary_color,
        background_color: menuTheme?.background_color,
        font_family: menuTheme?.font_family,
      }),
    [menuTheme?.primary_color, menuTheme?.background_color, menuTheme?.font_family],
  );

  const trimmed = text.trim();
  const tooLong = trimmed.length > NOTE_MAX_LENGTH;
  const unchanged = note !== null && trimmed === note.body;
  const canSave = trimmed !== '' && !tooLong && !unchanged && !saving;
  const dirty = trimmed !== (note?.body ?? '');
  // Starting points are offered until the owner writes something of their own.
  const offerTemplates =
    note === null && (trimmed === '' || TEMPLATE_BODIES.includes(text));

  const save = () => {
    if (canSave) onSave(trimmed);
  };

  return (
    <Dialog
      open={open}
      // A stray click beside the dialog must not throw away what was typed.
      onClose={(_event, reason) => {
        if (saving || (reason === 'backdropClick' && dirty)) return;
        onClose();
      }}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: (event: FormEvent) => {
            event.preventDefault();
            save();
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          {/* On a phone the title needs the width more than the badge does. */}
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <TonalIcon>
              <NotesRoundedIcon />
            </TonalIcon>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div">
              {note ? t('noteDialog.editTitle') : t('noteDialog.newTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('noteDialog.subtitle')}
            </Typography>
          </Box>
          <IconButton
            aria-label={t('common.close')}
            onClick={onClose}
            disabled={saving}
            edge="end"
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <TextField
          label={t('noteDialog.field')}
          placeholder={t('noteDialog.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter is a new line here; Ctrl/⌘ + Enter saves.
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              save();
            }
          }}
          multiline
          minRows={4}
          maxRows={12}
          autoFocus
          fullWidth
          disabled={saving}
          error={tooLong}
          helperText={
            <Box
              component="span"
              sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
            >
              <span>
                {note
                  ? t('noteDialog.hintEdit')
                  : placement === 'start'
                    ? t('noteDialog.hintTop')
                    : t('noteDialog.hintBottom')}
              </span>
              <Box component="span" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {trimmed.length} / {NOTE_MAX_LENGTH}
              </Box>
            </Box>
          }
          sx={{ mt: 1 }}
        />

        {offerTemplates && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" component="p">
              {t('noteDialog.templatesTitle')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {NOTE_TEMPLATES.map((template) => (
                <Chip
                  key={template.key}
                  label={t(`noteDialog.templates.${template.key}`)}
                  variant={text === template.body ? 'filled' : 'outlined'}
                  color={text === template.body ? 'primary' : 'default'}
                  clickable
                  disabled={saving}
                  onClick={() => setText(template.body)}
                />
              ))}
            </Box>
          </Box>
        )}

        {trimmed !== '' && (
          <Box sx={{ mt: 2.5 }} aria-hidden>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'center', color: 'text.secondary', mb: 1 }}
            >
              <SmartphoneRoundedIcon sx={{ fontSize: 16 }} />
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: '0.04em' }}
              >
                {t('noteDialog.preview')}
              </Typography>
            </Stack>
            <ThemeProvider theme={restaurantTheme}>
              <Box
                sx={{
                  bgcolor: 'background.default',
                  borderRadius: radii.md,
                  p: 1.5,
                  containerType: 'inline-size',
                  color: 'text.primary',
                }}
              >
                <MenuNoteCard body={trimmed.slice(0, NOTE_MAX_LENGTH)} />
              </Box>
            </ThemeProvider>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSave}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {note ? t('common.save') : t('noteDialog.add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
