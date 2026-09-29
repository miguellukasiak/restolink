import { memo, useState } from 'react';
import type { DraggableProvided } from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { MenuItem } from '../../types';
import { formatPln } from '../../constants/menu';
import { getTagIcon } from '../../constants/menuIcons';
import { radii } from '../../theme';
import { usePanelT } from '../../i18n/panel';
import { usePanelLabels } from '../../hooks/usePanelLabels';

const THUMB = 56;

interface MenuItemRowProps {
  item: MenuItem;
  provided: DraggableProvided;
  isDragging: boolean;
  /** Just saved — drawn with a brief glow so the eye finds it. */
  highlighted: boolean;
  onEdit: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem, isAvailable: boolean) => void;
  onDuplicate: (item: MenuItem) => void;
  onRequestDelete: (item: MenuItem) => void;
}

/**
 * One dish on the board: handle, photo, name and description, what the guest
 * will see flagged on it, the price, and the two things changed most often
 * without opening the editor — availability, and the overflow actions.
 *
 * The body is a real button ("Edytuj danie …") rather than a clickable card
 * wrapping the switch, so the switch and the menu are not controls nested
 * inside another control.
 *
 * `React.memo`-wrapped (see export): the board re-renders on every optimistic
 * change, and with stable handlers an untouched dish skips it.
 */
function MenuItemRowComponent({
  item,
  provided,
  isDragging,
  highlighted,
  onEdit,
  onToggleAvailability,
  onDuplicate,
  onRequestDelete,
}: MenuItemRowProps) {
  const { t } = usePanelT();
  const { allergenLabel, tagLabel } = usePanelLabels();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const available = item.is_available;
  const description = item.description.trim();

  return (
    <Box
      ref={provided.innerRef}
      {...provided.draggableProps}
      id={`dish-row-${item.id}`}
      sx={{ pb: 0.75 }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          gap: 0.5,
          p: 1,
          pl: 0.25,
          borderRadius: radii.md,
          border: '1px solid',
          borderColor: highlighted ? 'primary.main' : 'transparent',
          bgcolor: (t) =>
            highlighted
              ? alpha(t.palette.primary.main, 0.07)
              : t.palette.background.paper,
          transition:
            'background-color 0.4s ease, border-color 0.4s ease, box-shadow 0.2s ease',
          ...(isDragging
            ? {
                borderColor: 'primary.main',
                boxShadow: '0 16px 40px rgba(22, 28, 37, 0.18)',
              }
            : {
                '&:hover': {
                  bgcolor: (t) =>
                    highlighted
                      ? alpha(t.palette.primary.main, 0.07)
                      : alpha(t.palette.text.primary, 0.035),
                },
                '&:hover .drag-handle': { color: 'text.secondary' },
              }),
        }}
      >
        <Box
          {...provided.dragHandleProps}
          className="drag-handle"
          aria-label={t('dish.drag', { name: item.name })}
          sx={{
            display: 'flex',
            alignSelf: 'stretch',
            alignItems: 'center',
            px: 0.25,
            borderRadius: radii.xs,
            color: 'text.disabled',
            cursor: 'grab',
            transition: 'color 0.2s ease',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>

        <ButtonBase
          onClick={() => onEdit(item)}
          aria-label={t('dish.edit', { name: item.name })}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 1.5,
            textAlign: 'left',
            borderRadius: radii.xs,
          }}
        >
          <Box
            sx={{
              width: { xs: 48, sm: THUMB },
              height: { xs: 48, sm: THUMB },
              flex: '0 0 auto',
              borderRadius: radii.xs,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              color: (t) => alpha(t.palette.primary.main, 0.55),
              filter: available ? 'none' : 'grayscale(100%)',
              opacity: available ? 1 : 0.6,
            }}
          >
            {item.image_url ? (
              <Box
                component="img"
                src={item.image_url}
                alt=""
                loading="lazy"
                decoding="async"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <RestaurantMenuRoundedIcon fontSize="small" />
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ color: available ? 'text.primary' : 'text.secondary' }}
            >
              {item.name}
            </Typography>
            {/* On a phone the price moves under the name, where the
                description would be — beside the switch it squeezed the
                name down to a few letters. */}
            <Typography
              variant="body2"
              sx={{
                display: { xs: 'block', sm: 'none' },
                fontWeight: 700,
                color: available ? 'text.primary' : 'text.secondary',
              }}
            >
              {formatPln(item.price)}
            </Typography>
            <Typography
              variant="caption"
              component="p"
              noWrap
              sx={{
                display: { xs: 'none', sm: 'block' },
                color: description ? 'text.secondary' : 'text.disabled',
                fontStyle: description ? 'normal' : 'italic',
              }}
            >
              {description || t('dish.noDescription')}
            </Typography>
            {(!available || item.tags.length > 0 || item.allergens.length > 0) && (
              <Stack
                direction="row"
                useFlexGap
                spacing={0.5}
                sx={{ mt: 0.5, flexWrap: 'wrap' }}
              >
                {!available && (
                  <Chip
                    size="small"
                    label={t('dish.unavailable')}
                    sx={{ height: 20, fontSize: 11, bgcolor: 'action.selected' }}
                  />
                )}
                {item.tags.map((tag) => (
                  <Chip
                    key={tag}
                    size="small"
                    icon={getTagIcon(tag)}
                    label={tagLabel(tag)}
                    sx={{
                      height: 20,
                      fontSize: 11,
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                      color: 'primary.dark',
                      '& .MuiChip-icon': { fontSize: 13, color: 'primary.main', ml: 0.5 },
                    }}
                  />
                ))}
                {item.allergens.length > 0 && (
                  <Tooltip
                    title={t('dish.allergensTooltip', {
                      list: item.allergens.map(allergenLabel).join(', '),
                    })}
                    arrow
                  >
                    <Chip
                      size="small"
                      label={t('count.allergens', { count: item.allergens.length })}
                      sx={{
                        height: 20,
                        fontSize: 11,
                        bgcolor: (t) => alpha(t.palette.warning.main, 0.1),
                        color: 'warning.dark',
                      }}
                    />
                  </Tooltip>
                )}
              </Stack>
            )}
          </Box>

          <Typography
            variant="subtitle2"
            noWrap
            sx={{
              display: { xs: 'none', sm: 'block' },
              flexShrink: 0,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: available ? 'text.primary' : 'text.secondary',
              pl: 1,
            }}
          >
            {formatPln(item.price)}
          </Typography>
        </ButtonBase>

        <Tooltip
          title={available ? t('dish.availableHint') : t('dish.unavailable')}
          arrow
        >
          <Switch
            size="small"
            checked={available}
            onChange={(event) => onToggleAvailability(item, event.target.checked)}
            slotProps={{
              input: { 'aria-label': t('dish.availability', { name: item.name }) },
            }}
            sx={{ ml: 0.5 }}
          />
        </Tooltip>

        <IconButton
          size="small"
          aria-label={t('dish.more', { name: item.name })}
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
              onEdit(item);
            }}
          >
            <ListItemIcon>
              <EditRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('common.edit')}</ListItemText>
          </MuiMenuItem>
          <MuiMenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDuplicate(item);
            }}
          >
            <ListItemIcon>
              <ContentCopyRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('dish.duplicate')}</ListItemText>
          </MuiMenuItem>
          <MuiMenuItem
            onClick={() => {
              setMenuAnchor(null);
              onRequestDelete(item);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('common.delete')}</ListItemText>
          </MuiMenuItem>
        </Menu>
      </Stack>
    </Box>
  );
}

export const MenuItemRow = memo(MenuItemRowComponent);
