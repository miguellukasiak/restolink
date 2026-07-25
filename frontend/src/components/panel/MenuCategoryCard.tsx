import { useState } from 'react';
import {
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  Droppable,
  type DroppableProvided,
  type DroppableStateSnapshot,
} from '@hello-pangea/dnd';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { MenuCategory, MenuItem } from '../../types';
import { MenuItemCard } from './MenuItemCard';

const COLUMN_WIDTH = 360;

interface MenuCategoryCardProps {
  category: MenuCategory;
  /** Position in the board — required by the outer horizontal Draggable. */
  index: number;
  onAddItem: (category: MenuCategory) => void;
  onEditItem: (category: MenuCategory, item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem, isAvailable: boolean) => void;
  onRenameCategory: (category: MenuCategory, name: string) => void;
  onRequestDeleteCategory: (category: MenuCategory) => void;
  onRequestDeleteItem: (item: MenuItem) => void;
}

/**
 * One draggable category column. A single cohesive Paper holds the header (with
 * a drag handle, inline-editable title, and delete action), the droppable list
 * of dishes, and the dashed "add dish" button.
 */
export function MenuCategoryCard({
  category,
  index,
  onAddItem,
  onEditItem,
  onToggleAvailability,
  onRenameCategory,
  onRequestDeleteCategory,
  onRequestDeleteItem,
}: MenuCategoryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  const startEdit = () => {
    setDraft(category.name);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(category.name);
    setIsEditing(false);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed !== category.name) onRenameCategory(category, trimmed);
    setIsEditing(false);
  };

  return (
    <Draggable draggableId={category.id} index={index}>
      {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
        <Paper
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          elevation={dragSnapshot.isDragging ? 8 : 1}
          sx={{
            width: COLUMN_WIDTH,
            flexShrink: 0,
            borderRadius: '24px',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            transition: 'box-shadow 0.2s ease',
            ...(dragSnapshot.isDragging && {
              boxShadow: '0 20px 48px rgba(28, 27, 34, 0.22)',
            }),
          }}
        >
          {/* Header: drag handle (icon only) + inline-editable title + actions */}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Box
              {...dragProvided.dragHandleProps}
              aria-label={`Przeciągnij kategorię ${category.name}`}
              sx={{
                display: 'flex',
                color: 'text.disabled',
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
              }}
            >
              <DragIndicatorIcon fontSize="small" />
            </Box>

            {isEditing ? (
              <TextField
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveEdit();
                  if (event.key === 'Escape') cancelEdit();
                }}
                size="small"
                autoFocus
                fullWidth
                slotProps={{ htmlInput: { 'aria-label': 'Nazwa kategorii' } }}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
                }}
              />
            ) : (
              <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {category.name}
              </Typography>
            )}

            {isEditing ? (
              <>
                <Tooltip title="Zapisz" arrow>
                  <span>
                    <IconButton
                      size="small"
                      color="secondary"
                      aria-label="Zapisz nazwę kategorii"
                      onClick={saveEdit}
                      disabled={!draft.trim()}
                    >
                      <CheckRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Anuluj" arrow>
                  <IconButton
                    size="small"
                    aria-label="Anuluj edycję nazwy"
                    onClick={cancelEdit}
                    sx={{ color: 'text.secondary' }}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <Chip
                  size="small"
                  label={category.items.length}
                  sx={{
                    fontWeight: 700,
                    bgcolor: (t) => alpha(t.palette.secondary.main, 0.12),
                    color: 'secondary.dark',
                  }}
                />
                <Tooltip title="Zmień nazwę" arrow>
                  <IconButton
                    size="small"
                    aria-label={`Zmień nazwę kategorii ${category.name}`}
                    onClick={startEdit}
                    sx={{ color: 'text.secondary' }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Usuń kategorię" arrow>
                  <IconButton
                    size="small"
                    aria-label={`Usuń kategorię ${category.name}`}
                    onClick={() => onRequestDeleteCategory(category)}
                    sx={{
                      color: 'text.disabled',
                      '&:hover': {
                        color: 'error.main',
                        bgcolor: (t) => alpha(t.palette.error.main, 0.08),
                      },
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>

          <Droppable droppableId={category.id} type="MENU_ITEM">
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <Stack
                ref={provided.innerRef}
                {...provided.droppableProps}
                spacing={1.25}
                sx={{
                  minHeight: 56,
                  borderRadius: 3,
                  p: 0.5,
                  transition: 'background-color 0.2s ease',
                  bgcolor: snapshot.isDraggingOver
                    ? (t) => alpha(t.palette.secondary.main, 0.08)
                    : 'transparent',
                }}
              >
                {category.items.length === 0 && !snapshot.isDraggingOver && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 48,
                      color: 'text.disabled',
                    }}
                  >
                    <Typography variant="caption">
                      Brak dań — dodaj pierwsze lub przeciągnij tutaj
                    </Typography>
                  </Box>
                )}
                {category.items.map((item, itemIndex) => (
                  <Draggable draggableId={item.id} index={itemIndex} key={item.id}>
                    {(itemProvided, itemSnapshot) => (
                      <MenuItemCard
                        item={item}
                        provided={itemProvided}
                        isDragging={itemSnapshot.isDragging}
                        onClick={() => onEditItem(category, item)}
                        onToggleAvailability={onToggleAvailability}
                        onRequestDelete={onRequestDeleteItem}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Stack>
            )}
          </Droppable>

          <Button
            onClick={() => onAddItem(category)}
            startIcon={<AddRoundedIcon />}
            color="secondary"
            sx={{
              borderRadius: 3,
              border: '2px dashed',
              borderColor: (t) => alpha(t.palette.secondary.main, 0.4),
              py: 1,
              justifyContent: 'flex-start',
              px: 2,
              '&:hover': {
                borderColor: 'secondary.main',
                bgcolor: (t) => alpha(t.palette.secondary.main, 0.06),
              },
            }}
          >
            Dodaj danie do „{category.name}"
          </Button>
        </Paper>
      )}
    </Draggable>
  );
}
