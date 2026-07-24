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
import { alpha } from '@mui/material/styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
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
}

/**
 * One draggable category column. A single cohesive Paper holds the header (with
 * category drag handle), the droppable list of dishes, and the dashed "add dish"
 * button — everything lives strictly inside this one container.
 */
export function MenuCategoryCard({
  category,
  index,
  onAddItem,
  onEditItem,
  onToggleAvailability,
}: MenuCategoryCardProps) {
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
          {/* Header — the drag handle for the whole category */}
          <Stack
            direction="row"
            spacing={1}
            {...dragProvided.dragHandleProps}
            sx={{
              alignItems: 'center',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }} noWrap>
              {category.name}
            </Typography>
            <Chip
              size="small"
              label={category.items.length}
              sx={{
                fontWeight: 700,
                bgcolor: (t) => alpha(t.palette.secondary.main, 0.12),
                color: 'secondary.dark',
              }}
            />
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
