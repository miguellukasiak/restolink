import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  type DropResult,
  type DroppableProvided,
} from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import type { MenuCategory, MenuItem } from '../../types';
import { useMenu } from '../../hooks/useMenu';
import { useSaveMenuItem } from '../../hooks/useSaveMenuItem';
import { useUpdateCategory } from '../../hooks/useUpdateCategory';
import { useDeleteCategory } from '../../hooks/useDeleteCategory';
import { useDeleteMenuItem } from '../../hooks/useDeleteMenuItem';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { MenuCategoryCard } from '../../components/panel/MenuCategoryCard';
import { MenuItemDrawer } from '../../components/panel/MenuItemDrawer';
import { AddCategoryColumn } from '../../components/panel/AddCategoryColumn';
import { AddCategoryDialog } from '../../components/panel/AddCategoryDialog';
import { ConfirmDialog } from '../../components/panel/ConfirmDialog';

interface DrawerState {
  open: boolean;
  categoryId: string;
  categoryName: string;
  item: MenuItem | null;
}

const CLOSED_DRAWER: DrawerState = {
  open: false,
  categoryId: '',
  categoryName: '',
  item: null,
};

/** What the confirmation dialog is about to delete. */
type DeleteTarget =
  | { kind: 'category'; category: MenuCategory }
  | { kind: 'item'; item: MenuItem };

/** Reorders an array immutably, moving the item at `from` to `to`. */
function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Skeleton shown while the menu loads. */
function MenuBoardSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 3 }}>
      {[0, 1, 2].map((key) => (
        <Paper key={key} elevation={1} sx={{ width: 360, borderRadius: '24px', p: 2 }}>
          <Skeleton variant="text" width="55%" height={32} />
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            <Skeleton variant="rounded" height={68} sx={{ borderRadius: 3 }} />
            <Skeleton variant="rounded" height={68} sx={{ borderRadius: 3 }} />
            <Skeleton variant="rounded" height={44} sx={{ borderRadius: 3 }} />
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

/**
 * "Kreator menu" — nested drag-and-drop board. Categories reorder horizontally
 * (type CATEGORY); dishes reorder vertically and move between categories
 * (type MENU_ITEM). All moves update local state optimistically.
 */
export function MenuBuilderPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const menu = useMenu(restaurantId);
  const saveMenuItem = useSaveMenuItem(restaurantId);
  const updateCategory = useUpdateCategory(restaurantId);
  const deleteCategory = useDeleteCategory(restaurantId);
  const deleteItem = useDeleteMenuItem(restaurantId);
  const { showError } = useSnackbar();

  // Local board state so drag-and-drop feels instant (optimistic UI).
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>(CLOSED_DRAWER);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menu.data) setCategories(menu.data);
  }, [menu.data]);

  // Desktop UX: translate vertical mouse-wheel scrolling into horizontal panning
  // (non-passive so we can preventDefault the page's vertical scroll).
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      // Only hijack the wheel when there is horizontal overflow to pan.
      if (el.scrollWidth <= el.clientWidth) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [menu.isLoading]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Horizontal category reordering.
    if (type === 'CATEGORY') {
      setCategories((previous) => reorder(previous, source.index, destination.index));
      return;
    }

    // Dish reordering within / across categories.
    setCategories((previous) => {
      const next = previous.map((category) => ({
        ...category,
        items: [...category.items],
      }));
      const from = next.find((category) => category.id === source.droppableId);
      const to = next.find((category) => category.id === destination.droppableId);
      if (!from || !to) return previous;

      const [moved] = from.items.splice(source.index, 1);
      to.items.splice(destination.index, 0, { ...moved, category_id: to.id });
      return next;
    });
  };

  /** Optimistically flips availability locally, then persists via upsert. */
  const handleToggleAvailability = (item: MenuItem, isAvailable: boolean) => {
    const applyFlag = (value: boolean) => {
      setCategories((previous) =>
        previous.map((category) => ({
          ...category,
          items: category.items.map((existing) =>
            existing.id === item.id
              ? { ...existing, is_available: value }
              : existing,
          ),
        })),
      );
    };

    applyFlag(isAvailable);
    saveMenuItem.mutate(
      {
        payload: {
          category_id: item.category_id,
          name: item.name,
          price: item.price,
          description: item.description || undefined,
          ingredients: item.ingredients || undefined,
          allergens: item.allergens,
          tags: item.tags,
          is_available: isAvailable,
          image_url: item.image_url,
        },
        itemId: item.id,
      },
      {
        onError: (error) => {
          applyFlag(!isAvailable);
          showError(getApiErrorMessage(error));
        },
      },
    );
  };

  /** Optimistically renames a category locally, then persists it. */
  const handleRenameCategory = (category: MenuCategory, name: string) => {
    const previousName = category.name;
    setCategories((previous) =>
      previous.map((c) => (c.id === category.id ? { ...c, name } : c)),
    );
    updateCategory.mutate(
      { categoryId: category.id, name },
      {
        onError: (error) => {
          setCategories((previous) =>
            previous.map((c) =>
              c.id === category.id ? { ...c, name: previousName } : c,
            ),
          );
          showError(getApiErrorMessage(error));
        },
      },
    );
  };

  /** Executes the pending deletion (category or item) optimistically. */
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const snapshot = categories;

    if (deleteTarget.kind === 'category') {
      const { category } = deleteTarget;
      setCategories((previous) => previous.filter((c) => c.id !== category.id));
      deleteCategory.mutate(category.id, {
        onError: (error) => {
          setCategories(snapshot);
          showError(getApiErrorMessage(error));
        },
      });
    } else {
      const { item } = deleteTarget;
      setCategories((previous) =>
        previous.map((c) => ({
          ...c,
          items: c.items.filter((i) => i.id !== item.id),
        })),
      );
      deleteItem.mutate(item.id, {
        onError: (error) => {
          setCategories(snapshot);
          showError(getApiErrorMessage(error));
        },
      });
    }
    setDeleteTarget(null);
  };

  const openCreateDrawer = (category: MenuCategory) => {
    setDrawer({
      open: true,
      categoryId: category.id,
      categoryName: category.name,
      item: null,
    });
  };

  const openEditDrawer = (category: MenuCategory, item: MenuItem) => {
    setDrawer({
      open: true,
      categoryId: category.id,
      categoryName: category.name,
      item,
    });
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', pt: 4 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Kreator menu</Typography>
        <Typography variant="body1" color="text.secondary">
          Przeciągaj kategorie, aby zmienić ich kolejność, a dania — aby przenieść je
          w obrębie sekcji lub między nimi. Kliknij danie, aby je edytować.
        </Typography>
      </Stack>

      {menu.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void menu.refetch()}>
              Spróbuj ponownie
            </Button>
          }
        >
          {getApiErrorMessage(menu.error)}
        </Alert>
      )}

      {menu.isLoading ? (
        <MenuBoardSkeleton />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Box
            ref={boardRef}
            sx={{
              display: 'flex',
              gap: 3,
              alignItems: 'flex-start',
              overflowX: 'auto',
              pb: 2,
            }}
          >
            <Droppable droppableId="board" direction="horizontal" type="CATEGORY">
              {(provided: DroppableProvided) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}
                >
                  {categories.map((category, index) => (
                    <MenuCategoryCard
                      key={category.id}
                      category={category}
                      index={index}
                      onAddItem={openCreateDrawer}
                      onEditItem={openEditDrawer}
                      onToggleAvailability={handleToggleAvailability}
                      onRenameCategory={handleRenameCategory}
                      onRequestDeleteCategory={(c) =>
                        setDeleteTarget({ kind: 'category', category: c })
                      }
                      onRequestDeleteItem={(item) =>
                        setDeleteTarget({ kind: 'item', item })
                      }
                    />
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>

            <AddCategoryColumn onClick={() => setAddCategoryOpen(true)} />
          </Box>
        </DragDropContext>
      )}

      {!menu.isLoading && !menu.isError && categories.length === 0 && (
        <Stack
          spacing={1.5}
          sx={{ mt: 4, alignItems: 'center', color: 'text.secondary' }}
        >
          <MenuBookRoundedIcon sx={{ fontSize: 56, opacity: 0.35 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            To menu nie ma jeszcze kategorii
          </Typography>
          <Typography variant="body2">
            Zacznij od dodania pierwszej kategorii po prawej stronie.
          </Typography>
        </Stack>
      )}

      <MenuItemDrawer
        open={drawer.open}
        restaurantId={restaurantId}
        categoryId={drawer.categoryId}
        categoryName={drawer.categoryName}
        item={drawer.item}
        onClose={() => setDrawer((previous) => ({ ...previous, open: false }))}
      />

      <AddCategoryDialog
        open={addCategoryOpen}
        restaurantId={restaurantId}
        onClose={() => setAddCategoryOpen(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'item' ? 'Usunąć danie?' : 'Usunąć kategorię?'}
        description={
          deleteTarget?.kind === 'category'
            ? `Kategoria „${deleteTarget.category.name}" i wszystkie jej dania zostaną trwale usunięte.`
            : deleteTarget?.kind === 'item'
              ? `Danie „${deleteTarget.item.name}" zostanie usunięte z menu.`
              : ''
        }
        confirmLabel="Usuń"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
