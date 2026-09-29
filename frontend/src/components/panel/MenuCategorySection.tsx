import { memo, useState } from 'react';
import {
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  Droppable,
  type DroppableProvided,
  type DroppableStateSnapshot,
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
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import type { MenuCategory, MenuItem } from '../../types';
import { radii } from '../../theme';
import { plCount } from '../../utils/plural';
import { MenuItemRow } from './MenuItemRow';

interface MenuCategorySectionProps {
  category: MenuCategory;
  /** Position on the board — required by the outer Draggable. */
  index: number;
  /** The dishes to show: all of them, or the ones a search or filter kept. */
  items: MenuItem[];
  collapsed: boolean;
  /** On while a search or filter hides rows: no dragging, since the visible
   *  positions are not the menu's, and no "add" row, which is off-task. */
  filtering: boolean;
  highlightedItemId: string | null;
  onToggleCollapsed: (categoryId: string) => void;
  onAddItem: (category: MenuCategory) => void;
  onEditItem: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem, isAvailable: boolean) => void;
  onDuplicateItem: (item: MenuItem) => void;
  onRequestDeleteItem: (item: MenuItem) => void;
  onRenameCategory: (category: MenuCategory, name: string) => void;
  onRequestDeleteCategory: (category: MenuCategory) => void;
}

/**
 * One category of the menu, top to bottom like the guest reads it: a header
 * you drag the whole section by, its dishes (which drag within it and into
 * other sections), and an "add a dish here" row at the foot.
 */
function MenuCategorySectionComponent({
  category,
  index,
  items,
  collapsed,
  filtering,
  highlightedItemId,
  onToggleCollapsed,
  onAddItem,
  onEditItem,
  onToggleAvailability,
  onDuplicateItem,
  onRequestDeleteItem,
  onRenameCategory,
  onRequestDeleteCategory,
}: MenuCategorySectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

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

  const total = category.items.length;

  return (
    <Draggable draggableId={category.id} index={index} isDragDisabled={filtering}>
      {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
        <Box ref={dragProvided.innerRef} {...dragProvided.draggableProps} sx={{ pb: 2 }}>
          <Paper
            id={`builder-category-${category.id}`}
            elevation={1}
            sx={{
              borderRadius: radii.lg,
              p: 1,
              transition: 'box-shadow 0.2s ease',
              ...(dragSnapshot.isDragging && {
                boxShadow: '0 24px 56px rgba(22, 28, 37, 0.22)',
              }),
            }}
          >
            {/* Header */}
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center', minHeight: 48, pl: 0.25, pr: 0.5 }}
            >
              <Box
                {...dragProvided.dragHandleProps}
                aria-label={`Przeciągnij kategorię ${category.name}`}
                sx={{
                  display: 'flex',
                  alignSelf: 'stretch',
                  alignItems: 'center',
                  px: 0.25,
                  borderRadius: radii.xs,
                  color: filtering ? 'action.disabled' : 'text.secondary',
                  cursor: filtering ? 'default' : 'grab',
                  '&:active': { cursor: filtering ? 'default' : 'grabbing' },
                }}
              >
                <DragIndicatorIcon fontSize="small" />
              </Box>

              {isEditing ? (
                <>
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
                    sx={{ flex: 1 }}
                  />
                  <Tooltip title="Zapisz" arrow>
                    <span>
                      <IconButton
                        size="small"
                        color="primary"
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
                  {/* The heading holds the toggle, not the other way round: a
                      heading inside a button is invalid HTML, and this is the
                      disclosure pattern screen readers expect. */}
                  <Typography
                    variant="h6"
                    component="h2"
                    sx={{ flex: 1, minWidth: 0, display: 'flex' }}
                  >
                    <ButtonBase
                      onClick={() => onToggleCollapsed(category.id)}
                      aria-expanded={!collapsed}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        justifyContent: 'flex-start',
                        gap: 1.25,
                        py: 0.75,
                        px: 0.75,
                        borderRadius: radii.sm,
                        textAlign: 'left',
                        font: 'inherit',
                      }}
                    >
                      <Typography
                        component="span"
                        variant="inherit"
                        noWrap
                        sx={{ minWidth: 0 }}
                      >
                        {category.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          flexShrink: 0,
                          px: 1,
                          py: 0.25,
                          borderRadius: radii.pill,
                          fontWeight: 700,
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                          color: 'primary.dark',
                        }}
                      >
                        {plCount(total, 'danie', 'dania', 'dań')}
                      </Typography>
                      <ExpandMoreRoundedIcon
                        fontSize="small"
                        sx={{
                          flexShrink: 0,
                          color: 'text.secondary',
                          transform: collapsed ? 'rotate(-90deg)' : 'none',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </ButtonBase>
                  </Typography>

                  <Tooltip title="Dodaj danie" arrow>
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label={`Dodaj danie do kategorii ${category.name}`}
                      onClick={() => onAddItem(category)}
                    >
                      <AddRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    size="small"
                    aria-label={`Więcej akcji: kategoria ${category.name}`}
                    aria-haspopup="menu"
                    onClick={(event) => setMenuAnchor(event.currentTarget)}
                    sx={{ color: 'text.secondary' }}
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
                        startEdit();
                      }}
                    >
                      <ListItemIcon>
                        <EditRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Zmień nazwę</ListItemText>
                    </MuiMenuItem>
                    <MuiMenuItem
                      onClick={() => {
                        setMenuAnchor(null);
                        onRequestDeleteCategory(category);
                      }}
                      sx={{ color: 'error.main' }}
                    >
                      <ListItemIcon sx={{ color: 'inherit' }}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Usuń kategorię</ListItemText>
                    </MuiMenuItem>
                  </Menu>
                </>
              )}
            </Stack>

            {!collapsed && (
              <Droppable droppableId={category.id} type="MENU_ITEM">
                {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      mt: 0.5,
                      minHeight: 8,
                      borderRadius: radii.md,
                      transition: 'background-color 0.2s ease',
                      bgcolor: snapshot.isDraggingOver
                        ? (t) => alpha(t.palette.primary.main, 0.06)
                        : 'transparent',
                    }}
                  >
                    {items.map((item, itemIndex) => (
                      <Draggable
                        draggableId={item.id}
                        index={itemIndex}
                        key={item.id}
                        isDragDisabled={filtering}
                      >
                        {(itemProvided, itemSnapshot) => (
                          <MenuItemRow
                            item={item}
                            provided={itemProvided}
                            isDragging={itemSnapshot.isDragging}
                            highlighted={item.id === highlightedItemId}
                            onEdit={onEditItem}
                            onToggleAvailability={onToggleAvailability}
                            onDuplicate={onDuplicateItem}
                            onRequestDelete={onRequestDeleteItem}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {/* Inside the drop zone on purpose: it gives an empty
                        category something to drop onto. */}
                    {!filtering && (
                      <ButtonBase
                        onClick={() => onAddItem(category)}
                        sx={{
                          width: '100%',
                          justifyContent: 'flex-start',
                          gap: 1.5,
                          p: 1,
                          pl: 3.75,
                          borderRadius: radii.md,
                          border: '1.5px dashed',
                          borderColor: (t) => alpha(t.palette.primary.main, 0.3),
                          color: 'primary.main',
                          transition:
                            'border-color 0.2s ease, background-color 0.2s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: radii.xs,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                          }}
                        >
                          <AddRoundedIcon fontSize="small" />
                        </Box>
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="subtitle2">
                            {total === 0 ? 'Dodaj pierwsze danie' : 'Dodaj danie'}
                          </Typography>
                          {total === 0 && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              component="p"
                            >
                              …albo przeciągnij tu danie z innej kategorii
                            </Typography>
                          )}
                        </Box>
                      </ButtonBase>
                    )}
                  </Box>
                )}
              </Droppable>
            )}
          </Paper>
        </Box>
      )}
    </Draggable>
  );
}

export const MenuCategorySection = memo(MenuCategorySectionComponent);
