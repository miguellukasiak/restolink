import type { DraggableProvided } from '@hello-pangea/dnd';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { MenuItem } from '../../types';
import { formatPln } from '../../constants/menu';

interface MenuItemCardProps {
  item: MenuItem;
  provided: DraggableProvided;
  isDragging: boolean;
  onClick: () => void;
  onToggleAvailability: (item: MenuItem, isAvailable: boolean) => void;
  onRequestDelete: (item: MenuItem) => void;
}

/**
 * A single dish inside a category column: thumbnail, name, snippet, price and
 * a quick availability switch (does not open the edit drawer).
 */
export function MenuItemCard({
  item,
  provided,
  isDragging,
  onClick,
  onToggleAvailability,
  onRequestDelete,
}: MenuItemCardProps) {
  const available = item.is_available;

  return (
    <Paper
      ref={provided.innerRef}
      {...provided.draggableProps}
      variant="outlined"
      onClick={onClick}
      sx={{
        borderRadius: 3,
        p: 1.25,
        bgcolor: 'background.paper',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
        opacity: available ? 1 : 0.6,
        ...(isDragging
          ? {
              boxShadow: '0 12px 32px rgba(28, 27, 34, 0.18)',
              borderColor: 'secondary.main',
            }
          : {
              '&:hover': {
                borderColor: 'secondary.main',
                boxShadow: '0 4px 16px rgba(28, 27, 34, 0.08)',
              },
            }),
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Box
          {...provided.dragHandleProps}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Przeciągnij danie ${item.name}`}
          sx={{
            display: 'flex',
            color: 'text.disabled',
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>

        {item.image_url ? (
          <Box
            component="img"
            src={item.image_url}
            alt=""
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              flexShrink: 0,
              objectFit: 'cover',
              filter: available ? 'none' : 'grayscale(100%)',
            }}
          />
        ) : (
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette.secondary.main, 0.1),
              color: 'secondary.main',
            }}
          >
            <RestaurantMenuRoundedIcon fontSize="small" />
          </Box>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {item.name}
          </Typography>
          {item.description && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {item.description}
            </Typography>
          )}
          {item.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              {item.tags.slice(0, 2).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11 }}
                />
              ))}
            </Stack>
          )}
        </Box>

        <Stack sx={{ alignItems: 'flex-end', flexShrink: 0 }} spacing={0.25}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: 'secondary.dark' }}
          >
            {formatPln(item.price)}
          </Typography>
          <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
            <Tooltip
              title={available ? 'Dostępne — kliknij, aby ukryć' : 'Niedostępne'}
              arrow
            >
              <Switch
                size="small"
                color="secondary"
                checked={available}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onToggleAvailability(item, event.target.checked)}
                slotProps={{
                  input: { 'aria-label': `Dostępność dania ${item.name}` },
                }}
              />
            </Tooltip>
            <Tooltip title="Usuń danie" arrow>
              <IconButton
                size="small"
                aria-label={`Usuń danie ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestDelete(item);
                }}
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
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
