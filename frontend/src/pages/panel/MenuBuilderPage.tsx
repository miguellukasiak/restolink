import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  type BeforeCapture,
  type DropResult,
  type DroppableProvided,
} from '@hello-pangea/dnd';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SmartphoneRoundedIcon from '@mui/icons-material/SmartphoneRounded';
import type { MenuCategory, MenuItem } from '../../types';
import { CATEGORY_SUGGESTIONS, STARTER_CATEGORIES } from '../../constants/menu';
import { useMenu } from '../../hooks/useMenu';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { useSaveMenuItem } from '../../hooks/useSaveMenuItem';
import { useReorderMenu } from '../../hooks/useReorderMenu';
import { useAddCategory } from '../../hooks/useAddCategory';
import { useUpdateCategory } from '../../hooks/useUpdateCategory';
import { useDeleteCategory } from '../../hooks/useDeleteCategory';
import { useDeleteMenuItem } from '../../hooks/useDeleteMenuItem';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { radii } from '../../theme';
import { MenuCategorySection } from '../../components/panel/MenuCategorySection';
import { MenuItemEditorDialog } from '../../components/panel/MenuItemEditorDialog';
import { AddCategoryCard } from '../../components/panel/AddCategoryCard';
import { AddCategoryDialog } from '../../components/panel/AddCategoryDialog';
import { ConfirmDialog } from '../../components/panel/ConfirmDialog';
import { LiveMenuPreview } from '../../components/panel/LiveMenuPreview';
import { MenuReadiness, type DishFilter } from '../../components/panel/MenuReadiness';
import { MenuStarter } from '../../components/panel/MenuStarter';

interface EditorState {
  open: boolean;
  /** Where a new dish goes. */
  categoryId: string;
  item: MenuItem | null;
}

const CLOSED_EDITOR: EditorState = { open: false, categoryId: '', item: null };

/** What the confirmation dialog is about to delete. */
type DeleteTarget =
  | { kind: 'category'; category: MenuCategory }
  | { kind: 'item'; item: MenuItem };

/** How long a just-saved dish glows on the board. */
const HIGHLIGHT_MS = 1800;

/** Reorders an array immutably, moving the item at `from` to `to`. */
function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Puts the server's copy of a dish on the board: in place, or moved. */
function placeSaved(categories: MenuCategory[], saved: MenuItem): MenuCategory[] {
  return categories.map((category) => {
    const index = category.items.findIndex((item) => item.id === saved.id);
    if (category.id === saved.category_id) {
      if (index >= 0) {
        const items = [...category.items];
        items[index] = saved;
        return { ...category, items };
      }
      return { ...category, items: [...category.items, saved] };
    }
    return index >= 0
      ? { ...category, items: category.items.filter((item) => item.id !== saved.id) }
      : category;
  });
}

function dishMatches(item: MenuItem, query: string, filter: DishFilter): boolean {
  if (filter === 'no-photo' && item.image_url) return false;
  if (filter === 'no-description' && item.description.trim()) return false;
  if (filter === 'unavailable' && item.is_available) return false;
  if (!query) return true;
  return [item.name, item.description, item.ingredients]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

/** Skeleton shown while the menu loads. */
function BoardSkeleton() {
  return (
    <Stack spacing={2}>
      {[3, 2].map((rows, key) => (
        <Paper key={key} elevation={1} sx={{ borderRadius: radii.lg, p: 2 }}>
          <Skeleton variant="text" width="35%" height={32} />
          <Stack spacing={1} sx={{ mt: 1 }}>
            {Array.from({ length: rows }, (_, row) => (
              <Skeleton
                key={row}
                variant="rounded"
                height={72}
                sx={{ borderRadius: radii.md }}
              />
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

/**
 * "Kreator menu".
 *
 * The menu is edited the way a guest reads it — top to bottom, one section per
 * category — with the guest's phone beside it showing every change as it
 * happens. Categories drag by their header; dishes drag within a category and
 * across categories. Every drag is shown at once and saved in the background
 * (`useReorderMenu`), so the order survives a refresh.
 */
export function MenuBuilderPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const menu = useMenu(restaurantId);
  const publicMenu = usePublicMenu(restaurantId);
  const saveMenuItem = useSaveMenuItem(restaurantId);
  const reorderMenu = useReorderMenu(restaurantId);
  const addCategory = useAddCategory(restaurantId);
  const updateCategory = useUpdateCategory(restaurantId);
  const deleteCategory = useDeleteCategory(restaurantId);
  const deleteItem = useDeleteMenuItem(restaurantId);
  const { showSuccess, showError } = useSnackbar();

  // The board's own copy, so a drag or a switch is on screen before the
  // server has answered.
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [editor, setEditor] = useState<EditorState>(CLOSED_EDITOR);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DishFilter>('all');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [draggingCategory, setDraggingCategory] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [startingMenu, setStartingMenu] = useState(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  // The latest board, for callbacks that finish after a request: reading it
  // from a closure would see the board as it was when the request started.
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  useEffect(() => {
    if (menu.data) setCategories(menu.data);
  }, [menu.data]);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  /** Glides the phone to a category, so the owner sees the change land. */
  const showInPreview = useCallback((categoryId: string) => {
    // After the render that put the change on the board and the phone.
    setTimeout(() => {
      const scroller = previewScrollRef.current;
      const target = scroller?.querySelector<HTMLElement>(
        `[id="${CSS.escape(categoryId)}"]`,
      );
      if (!scroller || !target) return;
      const header = scroller.querySelector('header');
      const top =
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        (header?.getBoundingClientRect().height ?? 0);
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 60);
  }, []);

  /** Glows a dish for a moment and brings it into view on the board. */
  const highlight = useCallback((itemId: string) => {
    clearTimeout(highlightTimer.current);
    setHighlightedId(itemId);
    // A timer, not an animation: a hidden tab would freeze an animation on
    // its first frame (CLAUDE.md, trap 7).
    highlightTimer.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    setTimeout(() => {
      document
        .getElementById(`dish-row-${itemId}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 60);
  }, []);

  const persistOrder = useCallback(
    (next: MenuCategory[]) => {
      reorderMenu.mutate(next, {
        onError: (error) => showError(getApiErrorMessage(error)),
      });
    },
    [reorderMenu, showError],
  );

  const handleBeforeCapture = (before: BeforeCapture) => {
    // Grabbing a category folds every section to its header first, so the
    // whole menu fits on screen and the drop target is easy to see.
    if (categories.some((category) => category.id === before.draggableId)) {
      setDraggingCategory(true);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    setDraggingCategory(false);
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    let next: MenuCategory[];
    if (type === 'CATEGORY') {
      next = reorder(categories, source.index, destination.index);
    } else {
      next = categories.map((category) => ({ ...category, items: [...category.items] }));
      const from = next.find((category) => category.id === source.droppableId);
      const to = next.find((category) => category.id === destination.droppableId);
      if (!from || !to) return;
      const [moved] = from.items.splice(source.index, 1);
      to.items.splice(destination.index, 0, { ...moved, category_id: to.id });
      showInPreview(to.id);
    }
    setCategories(next);
    persistOrder(next);
  };

  /** Optimistically flips availability, then persists it via the upsert. */
  const handleToggleAvailability = useCallback(
    (item: MenuItem, isAvailable: boolean) => {
      const applyFlag = (value: boolean) => {
        setCategories((previous) =>
          previous.map((category) => ({
            ...category,
            items: category.items.map((existing) =>
              existing.id === item.id ? { ...existing, is_available: value } : existing,
            ),
          })),
        );
      };

      applyFlag(isAvailable);
      showInPreview(item.category_id);
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
    },
    [saveMenuItem, showError, showInPreview],
  );

  const handleDuplicate = useCallback(
    (item: MenuItem) => {
      saveMenuItem.mutate(
        {
          payload: {
            category_id: item.category_id,
            name: `${item.name} (kopia)`,
            price: item.price,
            description: item.description || undefined,
            ingredients: item.ingredients || undefined,
            allergens: item.allergens,
            tags: item.tags,
            is_available: item.is_available,
            image_url: item.image_url,
          },
        },
        {
          onSuccess: (copy) => {
            // The API appends a new dish to its category; a copy belongs
            // right under its original, so move it there and save that.
            const next = categoriesRef.current.map((category) => {
              if (category.id !== copy.category_id) return category;
              const items = category.items.filter((existing) => existing.id !== copy.id);
              const at = items.findIndex((existing) => existing.id === item.id);
              items.splice(at >= 0 ? at + 1 : items.length, 0, copy);
              return { ...category, items };
            });
            setCategories(next);
            persistOrder(next);
            highlight(copy.id);
            showInPreview(copy.category_id);
            showSuccess(`Utworzono kopię „${item.name}". Zmień w niej, co trzeba.`);
          },
          onError: (error) => showError(getApiErrorMessage(error)),
        },
      );
    },
    [saveMenuItem, persistOrder, highlight, showInPreview, showSuccess, showError],
  );

  /** Optimistically renames a category, then persists it. */
  const handleRenameCategory = useCallback(
    (category: MenuCategory, name: string) => {
      const previousName = category.name;
      setCategories((previous) =>
        previous.map((c) => (c.id === category.id ? { ...c, name } : c)),
      );
      showInPreview(category.id);
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
    },
    [updateCategory, showError, showInPreview],
  );

  const createCategory = (name: string) => {
    addCategory.mutate(name, {
      onSuccess: (created) => {
        showSuccess(`Dodano kategorię „${created.name}".`);
        setCategories((previous) =>
          previous.some((category) => category.id === created.id)
            ? previous
            : [...previous, created],
        );
        focusCategory(created.id);
      },
      onError: (error) => showError(getApiErrorMessage(error)),
    });
  };

  const focusCategory = (categoryId: string) => {
    showInPreview(categoryId);
    setTimeout(() => {
      document
        .getElementById(`builder-category-${categoryId}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 60);
  };

  const startMenu = async () => {
    setStartingMenu(true);
    try {
      // One at a time, so they are created in the order they are listed.
      for (const name of STARTER_CATEGORIES) {
        await addCategory.mutateAsync(name);
      }
      showSuccess('Gotowe! Teraz dodaj pierwsze dania.');
    } catch (error) {
      showError(getApiErrorMessage(error));
    } finally {
      setStartingMenu(false);
    }
  };

  /** Executes the pending deletion (category or dish) optimistically. */
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const snapshot = categories;

    if (deleteTarget.kind === 'category') {
      const { category } = deleteTarget;
      setCategories((previous) => previous.filter((c) => c.id !== category.id));
      deleteCategory.mutate(category.id, {
        onSuccess: () => showSuccess(`Usunięto kategorię „${category.name}".`),
        onError: (error) => {
          setCategories(snapshot);
          showError(getApiErrorMessage(error));
        },
      });
    } else {
      const { item } = deleteTarget;
      setCategories((previous) =>
        previous.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) })),
      );
      if (editor.item?.id === item.id)
        setEditor((previous) => ({ ...previous, open: false }));
      deleteItem.mutate(item.id, {
        onSuccess: () => showSuccess(`Usunięto „${item.name}".`),
        onError: (error) => {
          setCategories(snapshot);
          showError(getApiErrorMessage(error));
        },
      });
    }
    setDeleteTarget(null);
  };

  const openCreate = useCallback((category: MenuCategory) => {
    setEditor({ open: true, categoryId: category.id, item: null });
  }, []);

  const openEdit = useCallback((item: MenuItem) => {
    setEditor({ open: true, categoryId: item.category_id, item });
  }, []);

  const openEditById = (itemId: string) => {
    const item = categories
      .flatMap((category) => category.items)
      .find((i) => i.id === itemId);
    if (item) {
      setPreviewOpen(false);
      openEdit(item);
    }
  };

  const handleSaved = (saved: MenuItem) => {
    setCategories((previous) => placeSaved(previous, saved));
    highlight(saved.id);
    showInPreview(saved.category_id);
  };

  const handleToggleCollapsed = useCallback((categoryId: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  const handleRequestDeleteCategory = useCallback((category: MenuCategory) => {
    setDeleteTarget({ kind: 'category', category });
  }, []);

  const handleRequestDeleteItem = useCallback((item: MenuItem) => {
    setDeleteTarget({ kind: 'item', item });
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtering = normalizedQuery !== '' || filter !== 'all';

  // While searching or filtering, each section shows only what matched, and
  // sections with nothing left are hidden. Dragging is off meanwhile: the
  // positions of the visible rows are not their positions in the menu.
  const visible = useMemo(() => {
    if (!filtering) {
      return categories.map((category) => ({ category, items: category.items }));
    }
    return categories
      .map((category) => ({
        category,
        items: category.items.filter((item) =>
          dishMatches(item, normalizedQuery, filter),
        ),
      }))
      .filter(
        ({ category, items }) =>
          items.length > 0 ||
          (normalizedQuery !== '' &&
            filter === 'all' &&
            category.name.toLowerCase().includes(normalizedQuery)),
      );
  }, [categories, filtering, normalizedQuery, filter]);

  const suggestions = useMemo(() => {
    const taken = new Set(
      categories.map((category) => category.name.trim().toLowerCase()),
    );
    return CATEGORY_SUGGESTIONS.filter((name) => !taken.has(name.toLowerCase()));
  }, [categories]);

  const isEmpty = !menu.isLoading && !menu.isError && categories.length === 0;

  const preview = (
    <LiveMenuPreview
      restaurantId={restaurantId}
      categories={categories}
      publicMenu={publicMenu.data}
      onOpenItem={openEditById}
      scrollRef={previewScrollRef}
    />
  );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', pt: 4 }}>
      {/* Heading + tools */}
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { lg: 'flex-end' }, justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1">
            Kreator menu
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Przeciągaj, edytuj, dodawaj — a podgląd od razu pokaże, co zobaczy gość.
          </Typography>
        </Box>
        {!isEmpty && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <TextField
              size="small"
              placeholder="Szukaj dania"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setQuery('');
              }}
              sx={{
                width: { xs: '100%', sm: 220 },
                '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' },
              }}
              slotProps={{
                htmlInput: { 'aria-label': 'Szukaj dania' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: query ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label="Wyczyść wyszukiwanie"
                        onClick={() => setQuery('')}
                      >
                        <CloseRoundedIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
            {!wide && (
              <Button
                variant="outlined"
                startIcon={<SmartphoneRoundedIcon />}
                onClick={() => setPreviewOpen(true)}
                sx={{ flexShrink: 0 }}
              >
                Podgląd
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setAddCategoryOpen(true)}
              sx={{ flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Nowa kategoria
            </Button>
          </Stack>
        )}
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

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 300px' },
          columnGap: 5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {menu.isLoading ? (
            <BoardSkeleton />
          ) : isEmpty ? (
            <MenuStarter
              busy={startingMenu}
              onStart={() => void startMenu()}
              onCustom={() => setAddCategoryOpen(true)}
            />
          ) : (
            <>
              <Box sx={{ mb: 2.5 }}>
                <MenuReadiness
                  categories={categories}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              </Box>

              {filtering && (
                <Alert
                  severity="info"
                  icon={<SearchRoundedIcon fontSize="inherit" />}
                  sx={{ mb: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        setQuery('');
                        setFilter('all');
                      }}
                    >
                      Pokaż wszystko
                    </Button>
                  }
                >
                  {visible.length === 0
                    ? 'Nic nie pasuje. Spróbuj innej nazwy.'
                    : 'Pokazuję tylko pasujące dania. Przeciąganie wróci, gdy wyczyścisz filtr.'}
                </Alert>
              )}

              <DragDropContext
                onBeforeCapture={handleBeforeCapture}
                onDragEnd={handleDragEnd}
              >
                <Droppable droppableId="board" type="CATEGORY">
                  {(provided: DroppableProvided) => (
                    <Box ref={provided.innerRef} {...provided.droppableProps}>
                      {visible.map(({ category, items }, index) => (
                        <MenuCategorySection
                          key={category.id}
                          category={category}
                          index={index}
                          items={items}
                          collapsed={
                            draggingCategory || (!filtering && collapsed.has(category.id))
                          }
                          filtering={filtering}
                          highlightedItemId={highlightedId}
                          onToggleCollapsed={handleToggleCollapsed}
                          onAddItem={openCreate}
                          onEditItem={openEdit}
                          onToggleAvailability={handleToggleAvailability}
                          onDuplicateItem={handleDuplicate}
                          onRequestDeleteItem={handleRequestDeleteItem}
                          onRenameCategory={handleRenameCategory}
                          onRequestDeleteCategory={handleRequestDeleteCategory}
                        />
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </DragDropContext>

              {!filtering && (
                <AddCategoryCard
                  suggestions={suggestions.slice(0, 6)}
                  busy={addCategory.isPending}
                  onQuickAdd={createCategory}
                  onCustom={() => setAddCategoryOpen(true)}
                />
              )}
            </>
          )}
        </Box>

        {wide && <Box sx={{ position: 'sticky', top: 88 }}>{preview}</Box>}
      </Box>

      {/* Below lg there is no room beside the board, so the phone opens on demand. */}
      {!wide && (
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          aria-label="Podgląd menu"
          slotProps={{ paper: { sx: { p: 2.5, m: 1.5 } } }}
        >
          <LiveMenuPreview
            restaurantId={restaurantId}
            categories={categories}
            publicMenu={publicMenu.data}
            onOpenItem={openEditById}
            screenHeight="min(600px, calc(100dvh - 200px))"
            onClose={() => setPreviewOpen(false)}
          />
        </Dialog>
      )}

      <MenuItemEditorDialog
        open={editor.open}
        restaurantId={restaurantId}
        categories={categories}
        categoryId={editor.categoryId}
        item={editor.item}
        menuTheme={publicMenu.data?.restaurant.theme}
        onClose={() => setEditor((previous) => ({ ...previous, open: false }))}
        onSaved={handleSaved}
        onRequestDelete={handleRequestDeleteItem}
      />

      <AddCategoryDialog
        open={addCategoryOpen}
        restaurantId={restaurantId}
        suggestions={suggestions.slice(0, 8)}
        onClose={() => setAddCategoryOpen(false)}
        onCreated={(created) => {
          setCategories((previous) =>
            previous.some((category) => category.id === created.id)
              ? previous
              : [...previous, created],
          );
          focusCategory(created.id);
        }}
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
