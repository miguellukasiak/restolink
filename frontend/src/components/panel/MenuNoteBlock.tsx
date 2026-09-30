import { memo, useState } from 'react';
import {
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
} from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import type { MenuNote } from '../../types';
import { radii } from '../../theme';
import { usePanelT } from '../../i18n/panel';
import { TonalIcon } from './TonalIcon';
import { NoteText } from '../public/MenuNoteCard';
import { noteIconComponent, noteLook } from '../public/noteIcons';
import { plainNote } from '../public/noteMarkup';

interface MenuNoteBlockProps {
  note: MenuNote;
  /** Position on the board, among the categories — for the Draggable. */
  index: number;
  highlighted: boolean;
  onEdit: (note: MenuNote) => void;
  onRequestDelete: (note: MenuNote) => void;
}

/** The start of a note, on one line — enough to tell one from another. */
const excerpt = (body: string) => {
  const line = plainNote(body).replace(/\s+/g, ' ');
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
};

/**
 * A note on the board: the owner's own text between two sections, dragged by
 * its handle like a category and opened for editing with a click. Lighter
 * than a category, in the brand's tint, so the board shows at a glance which
 * blocks are dishes and which are words about them.
 */
function MenuNoteBlockComponent({
  note,
  index,
  highlighted,
  onEdit,
  onRequestDelete,
}: MenuNoteBlockProps) {
  const { t } = usePanelT();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const NoteIcon = noteIconComponent(noteLook(note.style).icon) ?? NotesRoundedIcon;
  // Long notes fade out at the foot of the block instead of stopping mid-line.
  const long = note.body.length > 220 || note.body.split('\n').length > 5;

  return (
    <Draggable draggableId={note.id} index={index}>
      {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
        <Box ref={dragProvided.innerRef} {...dragProvided.draggableProps} sx={{ pb: 2 }}>
          <Paper
            id={`builder-note-${note.id}`}
            elevation={0}
            sx={{
              borderRadius: radii.lg,
              p: 1,
              border: '1.5px solid',
              borderColor: (t) =>
                highlighted || dragSnapshot.isDragging
                  ? t.palette.primary.main
                  : alpha(t.palette.primary.main, 0.22),
              bgcolor: (t) => alpha(t.palette.primary.main, highlighted ? 0.09 : 0.035),
              transition:
                'background-color 0.4s ease, border-color 0.4s ease, box-shadow 0.2s ease',
              ...(dragSnapshot.isDragging && {
                bgcolor: 'background.paper',
                boxShadow: '0 24px 56px rgba(22, 28, 37, 0.22)',
              }),
            }}
          >
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
              <Box
                {...dragProvided.dragHandleProps}
                aria-label={t('note.drag')}
                sx={{
                  display: 'flex',
                  alignSelf: 'stretch',
                  alignItems: 'center',
                  px: 0.25,
                  borderRadius: radii.xs,
                  color: 'text.secondary',
                  cursor: 'grab',
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <DragIndicatorIcon fontSize="small" />
              </Box>

              {/* A div with the button role, not a <button>: it holds block
                  content (the icon badge, two paragraphs). */}
              <ButtonBase
                component="div"
                onClick={() => onEdit(note)}
                aria-label={t('note.edit', { text: excerpt(note.body) })}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 0.75,
                  borderRadius: radii.sm,
                  textAlign: 'left',
                }}
              >
                <TonalIcon size={36}>
                  <NoteIcon fontSize="small" />
                </TonalIcon>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    component="p"
                    sx={{
                      fontWeight: 700,
                      color: 'primary.dark',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {t('note.label')}
                  </Typography>
                  <Box
                    sx={{
                      typography: 'body2',
                      maxHeight: '8.5em',
                      overflow: 'hidden',
                      ...(long && {
                        WebkitMaskImage: 'linear-gradient(black 70%, transparent)',
                        maskImage: 'linear-gradient(black 70%, transparent)',
                      }),
                    }}
                  >
                    <NoteText body={note.body} />
                  </Box>
                </Box>
              </ButtonBase>

              <IconButton
                size="small"
                aria-label={t('note.more')}
                aria-haspopup="menu"
                onClick={(event) => setMenuAnchor(event.currentTarget)}
                sx={{ color: 'text.secondary', mt: 0.5 }}
              >
                <MoreHorizRoundedIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={menuAnchor !== null}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MuiMenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onEdit(note);
                  }}
                >
                  <ListItemIcon>
                    <EditRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('note.editShort')}</ListItemText>
                </MuiMenuItem>
                <MuiMenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onRequestDelete(note);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon sx={{ color: 'inherit' }}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('note.delete')}</ListItemText>
                </MuiMenuItem>
              </Menu>
            </Stack>
          </Paper>
        </Box>
      )}
    </Draggable>
  );
}

export const MenuNoteBlock = memo(MenuNoteBlockComponent);
