import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ThemeProvider, alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import SmartphoneRoundedIcon from '@mui/icons-material/SmartphoneRounded';
import FormatBoldRoundedIcon from '@mui/icons-material/FormatBoldRounded';
import FormatItalicRoundedIcon from '@mui/icons-material/FormatItalicRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import FormatAlignLeftRoundedIcon from '@mui/icons-material/FormatAlignLeftRounded';
import FormatAlignCenterRoundedIcon from '@mui/icons-material/FormatAlignCenterRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import type { MenuNote, MenuNoteStyle, RestaurantThemeSettings } from '../../types';
import { NOTE_MAX_LENGTH, NOTE_TEMPLATES } from '../../constants/menu';
import { createRestaurantTheme } from '../public/RestaurantThemeProvider';
import { MenuNoteCard } from '../public/MenuNoteCard';
import { NOTE_ICONS, noteLook, type NoteIcon } from '../public/noteIcons';
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
  /** Starting texts by `NOTE_TEMPLATES` key, in the menu's language. */
  templates?: Record<string, string>;
  saving: boolean;
  onClose: () => void;
  onSave: (body: string, style: MenuNoteStyle) => void;
}

const LINE_PREFIX = /^(#|[-•])\s+/;

const sameLook = (a: MenuNoteStyle, b: MenuNoteStyle) =>
  a.icon === b.icon && a.variant === b.variant && a.align === b.align;

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      variant="caption"
      component="p"
      sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

/**
 * Writes or rewrites a note: its text with light formatting, its icon, frame
 * and alignment, and the note as guests will see it in the restaurant's own
 * colours — every change shows in the preview as it is made.
 *
 * Formatting is a small markup in the text itself (**bold**, *italic*, "# "
 * heading, "- " list; see noteMarkup.ts) that the toolbar and Ctrl+B / Ctrl+I
 * write for the owner. Plain text in a textarea, rather than a rich-text
 * widget, keeps the stored note a phrase the translation dictionary can hold
 * and the guest menu can render without ever parsing HTML.
 */
export function MenuNoteDialog({
  open,
  note,
  placement,
  menuTheme,
  templates,
  saving,
  onClose,
  onSave,
}: MenuNoteDialogProps) {
  const { t } = usePanelT();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [text, setText] = useState('');
  const [look, setLook] = useState<MenuNoteStyle>(noteLook(undefined));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText(note?.body ?? '');
    setLook(noteLook(note?.style));
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

  const original = noteLook(note?.style);
  const trimmed = text.trim();
  const tooLong = trimmed.length > NOTE_MAX_LENGTH;
  const unchanged = note !== null && trimmed === note.body && sameLook(look, original);
  const canSave = trimmed !== '' && !tooLong && !unchanged && !saving;
  const dirty = trimmed !== (note?.body ?? '') || !sameLook(look, original);
  // Starting points are offered until the owner writes something of their own.
  const starting = templates
    ? NOTE_TEMPLATES.filter((template) => templates[template.key])
    : [];
  const offerTemplates =
    note === null &&
    starting.length > 0 &&
    (trimmed === '' || starting.some((template) => templates?.[template.key] === text));

  const save = () => {
    if (canSave) onSave(trimmed, look);
  };

  /** Replaces the text and puts the selection back where the edit was. */
  const edit = (next: string, start: number, end: number) => {
    setText(next);
    requestAnimationFrame(() => {
      const field = inputRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(start, end);
    });
  };

  /** Bold or italic around the selection; again on the same text undoes it. */
  const wrap = (marker: '**' | '*') => {
    const field = inputRef.current;
    if (!field) return;
    const { selectionStart: from, selectionEnd: to, value } = field;
    const before = value.slice(0, from);
    const inside = value.slice(from, to);
    const after = value.slice(to);
    // Italic inside bold ("**word**") must not read the bold's stars as its own.
    const insideBold = before.endsWith('**') && after.startsWith('**');
    if (
      before.endsWith(marker) &&
      after.startsWith(marker) &&
      (marker === '**' || !insideBold)
    ) {
      edit(
        before.slice(0, -marker.length) + inside + after.slice(marker.length),
        from - marker.length,
        to - marker.length,
      );
      return;
    }
    // Spaces stay outside the markers — "**word** ", never "**word **",
    // which would not read as bold.
    const word = inside.replace(/\s+$/, '');
    const trail = inside.slice(word.length);
    edit(
      before + marker + word + marker + trail + after,
      from + marker.length,
      from + marker.length + word.length,
    );
  };

  /** A heading or list prefix on every selected line; again takes it off. */
  const prefixLines = (prefix: '# ' | '- ') => {
    const field = inputRef.current;
    if (!field) return;
    const { selectionStart: from, selectionEnd: to, value } = field;
    const start = value.lastIndexOf('\n', from - 1) + 1;
    const newline = value.indexOf('\n', to);
    const end = newline === -1 ? value.length : newline;
    const lines = value.slice(start, end).split('\n');
    const has = (line: string) =>
      prefix === '# ' ? /^#\s+/.test(line) : /^[-•]\s+/.test(line);
    const all = lines.every(has);
    const changed = lines
      .map((line) =>
        all ? line.replace(LINE_PREFIX, '') : prefix + line.replace(LINE_PREFIX, ''),
      )
      .join('\n');
    edit(
      value.slice(0, start) + changed + value.slice(end),
      start,
      start + changed.length,
    );
  };

  const tools = [
    {
      label: t('noteDialog.bold'),
      icon: <FormatBoldRoundedIcon fontSize="small" />,
      run: () => wrap('**'),
    },
    {
      label: t('noteDialog.italic'),
      icon: <FormatItalicRoundedIcon fontSize="small" />,
      run: () => wrap('*'),
    },
    {
      label: t('noteDialog.heading'),
      icon: <TitleRoundedIcon fontSize="small" />,
      run: () => prefixLines('# '),
    },
    {
      label: t('noteDialog.list'),
      icon: <FormatListBulletedRoundedIcon fontSize="small" />,
      run: () => prefixLines('- '),
    },
  ];

  const iconChoices: { key: NoteIcon | null; label: string }[] = [
    { key: null, label: t('noteDialog.noIcon') },
    ...(Object.keys(NOTE_ICONS) as NoteIcon[]).map((key) => ({
      key,
      label: t(`noteDialog.icons.${key}`),
    })),
  ];

  const editor = (
    <Box sx={{ minWidth: 0 }}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: tooLong ? 'error.main' : 'divider',
          borderRadius: radii.md,
          overflow: 'hidden',
          '&:focus-within': {
            borderColor: tooLong ? 'error.main' : 'primary.main',
            boxShadow: (th) =>
              `0 0 0 1px ${tooLong ? th.palette.error.main : th.palette.primary.main}`,
          },
        }}
      >
        <Stack
          direction="row"
          spacing={0.25}
          role="toolbar"
          aria-label={t('noteDialog.toolbar')}
          sx={{
            px: 0.75,
            py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (th) => alpha(th.palette.text.primary, 0.03),
          }}
        >
          {tools.map((tool) => (
            <Tooltip key={tool.label} title={tool.label} arrow>
              <span>
                <IconButton
                  size="small"
                  aria-label={tool.label}
                  disabled={saving}
                  // Keeps the selection in the text while the button is pressed.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={tool.run}
                >
                  {tool.icon}
                </IconButton>
              </span>
            </Tooltip>
          ))}
        </Stack>
        <TextField
          inputRef={inputRef}
          placeholder={t('noteDialog.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            const key = event.key.toLowerCase();
            // Enter is a new line here; Ctrl/⌘ + Enter saves.
            if (event.key === 'Enter') save();
            else if (key === 'b') wrap('**');
            else if (key === 'i') wrap('*');
            else return;
            event.preventDefault();
          }}
          multiline
          minRows={5}
          maxRows={14}
          autoFocus={!phone}
          fullWidth
          disabled={saving}
          slotProps={{ htmlInput: { 'aria-label': t('noteDialog.field') } }}
          sx={{
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiInputBase-root': { borderRadius: 0 },
          }}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          mt: 0.75,
          px: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {note
            ? t('noteDialog.hintEdit')
            : placement === 'start'
              ? t('noteDialog.hintTop')
              : t('noteDialog.hintBottom')}
        </Typography>
        <Typography
          variant="caption"
          color={tooLong ? 'error' : 'text.secondary'}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {trimmed.length} / {NOTE_MAX_LENGTH}
        </Typography>
      </Box>

      <Typography
        variant="caption"
        component="p"
        color="text.secondary"
        sx={{
          mt: 1.5,
          px: 1.25,
          py: 1,
          borderRadius: radii.sm,
          bgcolor: (th) => alpha(th.palette.text.primary, 0.035),
        }}
      >
        {t('noteDialog.markupHint')}
      </Typography>

      {offerTemplates && (
        <Box sx={{ mt: 2 }}>
          <SectionLabel>{t('noteDialog.templatesTitle')}</SectionLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {starting.map((template) => {
              const body = templates?.[template.key] ?? '';
              const chosen = text === body;
              return (
                <Chip
                  key={template.key}
                  label={t(`noteDialog.templates.${template.key}`)}
                  variant={chosen ? 'filled' : 'outlined'}
                  color={chosen ? 'primary' : 'default'}
                  clickable
                  disabled={saving}
                  onClick={() => {
                    setText(body);
                    setLook((current) => ({ ...current, icon: template.icon }));
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );

  const options = (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Box>
        <SectionLabel>{t('noteDialog.icon')}</SectionLabel>
        <Box
          role="radiogroup"
          aria-label={t('noteDialog.icon')}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
        >
          {iconChoices.map(({ key, label }) => {
            const Icon = key ? NOTE_ICONS[key] : BlockRoundedIcon;
            const chosen = look.icon === key;
            return (
              <Tooltip key={key ?? 'none'} title={label} arrow>
                <IconButton
                  role="radio"
                  aria-checked={chosen}
                  aria-label={label}
                  disabled={saving}
                  onClick={() => setLook((current) => ({ ...current, icon: key }))}
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: radii.sm,
                    border: '1.5px solid',
                    borderColor: chosen ? 'primary.main' : 'divider',
                    bgcolor: (th) =>
                      chosen ? alpha(th.palette.primary.main, 0.12) : 'transparent',
                    color: chosen
                      ? 'primary.main'
                      : key
                        ? 'text.primary'
                        : 'text.secondary',
                  }}
                >
                  <Icon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      <Box>
        <SectionLabel>{t('noteDialog.look')}</SectionLabel>
        <ToggleButtonGroup
          exclusive
          size="small"
          fullWidth
          value={look.variant}
          onChange={(_event, variant: MenuNoteStyle['variant'] | null) => {
            if (variant) setLook((current) => ({ ...current, variant }));
          }}
          aria-label={t('noteDialog.look')}
          disabled={saving}
        >
          <ToggleButton value="card">{t('noteDialog.variants.card')}</ToggleButton>
          <ToggleButton value="filled">{t('noteDialog.variants.filled')}</ToggleButton>
          <ToggleButton value="plain">{t('noteDialog.variants.plain')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box>
        <SectionLabel>{t('noteDialog.align')}</SectionLabel>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={look.align}
          onChange={(_event, align: MenuNoteStyle['align'] | null) => {
            if (align) setLook((current) => ({ ...current, align }));
          }}
          aria-label={t('noteDialog.align')}
          disabled={saving}
        >
          <ToggleButton value="left" aria-label={t('noteDialog.alignLeft')}>
            <FormatAlignLeftRoundedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="center" aria-label={t('noteDialog.alignCenter')}>
            <FormatAlignCenterRoundedIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box aria-hidden>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', color: 'text.secondary', mb: 0.75 }}
        >
          <SmartphoneRoundedIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
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
            {trimmed ? (
              <MenuNoteCard body={trimmed.slice(0, NOTE_MAX_LENGTH)} style={look} />
            ) : (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}
              >
                {t('noteDialog.previewEmpty')}
              </Typography>
            )}
          </Box>
        </ThemeProvider>
      </Box>
    </Stack>
  );

  return (
    <Dialog
      open={open}
      // A stray click beside the dialog must not throw away what was typed.
      onClose={(_event, reason) => {
        if (saving || (reason === 'backdropClick' && dirty)) return;
        onClose();
      }}
      maxWidth="md"
      fullWidth
      fullScreen={phone}
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(0, 1.25fr) minmax(0, 1fr)',
            },
            gap: 3,
            pt: 1,
          }}
        >
          {editor}
          {options}
        </Box>
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
