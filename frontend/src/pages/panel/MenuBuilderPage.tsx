import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import type { MenuCategory, MenuItem, MenuNote, MenuNoteStyle } from '../../types';
import { starterCategories } from '../../constants/starterTexts';
import { useMenu } from '../../hooks/useMenu';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { useMenuStarterTexts } from '../../hooks/useStarterTexts';
import { useSaveMenuItem } from '../../hooks/useSaveMenuItem';
import { useReorderMenu } from '../../hooks/useReorderMenu';
import { useAddCategory } from '../../hooks/useAddCategory';
import { useUpdateCategory } from '../../hooks/useUpdateCategory';
import { useDeleteCategory } from '../../hooks/useDeleteCategory';
import { useDeleteMenuItem } from '../../hooks/useDeleteMenuItem';
import {
  useAddMenuNote,
  useDeleteMenuNote,
  useMenuNotes,
  useUpdateMenuNote,
} from '../../hooks/useMenuNotes';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { radii } from '../../theme';
import { MenuCategorySection } from '../../components/panel/MenuCategorySection';
import { MenuItemEditorDialog } from '../../components/panel/MenuItemEditorDialog';
import { AddCategoryCard } from '../../components/panel/AddCategoryCard';
import { AddCategoryDialog } from '../../components/panel/AddCategoryDialog';
import { ConfirmDialog } from '../../components/panel/ConfirmDialog';
import { LiveMenuPreview } from '../../components/panel/LiveMenuPreview';
import { useFittedPhone } from '../../hooks/useFittedPhone';
import { MenuReadiness, type DishFilter } from '../../components/panel/MenuReadiness';
import { MenuStarter } from '../../components/panel/MenuStarter';
import { MenuNoteBlock } from '../../components/panel/MenuNoteBlock';
import { MenuNoteDialog } from '../../components/panel/MenuNoteDialog';
import { DishTranslationDialog } from '../../components/panel/DishTranslationDialog';
import { menuLanguagesQueryKey, useMenuLanguages } from '../../hooks/useMenuLanguages';
import { fetchMenuLanguages } from '../../services/languagesService';
import {
  gapsFor,
  introducedTexts,
  untranslatedDishes,
} from '../../utils/translationGaps';
import { menuSections, renumber } from '../../utils/menuLayout';
import { usePanelT } from '../../i18n/panel';

interface EditorState {
  open: boolean;
  /** Where a new dish goes. */
  categoryId: string;
  item: MenuItem | null;
}

const CLOSED_EDITOR: EditorState = { open: false, categoryId: '', item: null };

interface NoteEditorState {
  open: boolean;
  /** Null writes a new note. */
  note: MenuNote | null;
  /** Where a new note lands: the header's button puts it at the top, the
   *  foot of the board at the bottom. */
  placement: 'start' | 'end';
}

const CLOSED_NOTE_EDITOR: NoteEditorState = {
  open: false,
  note: null,
  placement: 'start',
};

/** What the confirmation dialog is about to delete. */
type DeleteTarget =
  | { kind: 'category'; category: MenuCategory }
  | { kind: 'item'; item: MenuItem }
  | { kind: 'note'; note: MenuNote };

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
 * across categories; notes — the owner's own text, such as lunch hours — sit
 * between the categories and drag among them. Every drag is shown at once and
 * saved in the background (`useReorderMenu`), so the order survives a refresh.
 */
export function MenuBuilderPage() {
  const { t } = usePanelT();
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  // Beside the board the phone starts level with the page title and stays in
  // view while the board scrolls. Around it: the app bar and page padding
  // (96px), its "Podgląd na żywo" row and caption with their gaps (~75px) and
  // a little air below.
  const sidePhone = useFittedPhone({ reserveY: 190 });
  // In the dialog: its margins (32px each side on a tablet) and padding plus
  // the same row and caption.
  const dialogPhone = useFittedPhone({ reserveY: 200, reserveX: 72 });
  const menu = useMenu(restaurantId);
  const publicMenu = usePublicMenu(restaurantId);
  // Category names and note templates in the menu's own language.
  const starterTexts = useMenuStarterTexts(restaurantId);
  const starterNames = useMemo(
    () => (starterTexts ? starterCategories(starterTexts) : []),
    [starterTexts],
  );
  const saveMenuItem = useSaveMenuItem(restaurantId);
  const reorderMenu = useReorderMenu(restaurantId);
  const addCategory = useAddCategory(restaurantId);
  const updateCategory = useUpdateCategory(restaurantId);
  const deleteCategory = useDeleteCategory(restaurantId);
  const deleteItem = useDeleteMenuItem(restaurantId);
  const menuNotes = useMenuNotes(restaurantId);
  const addNote = useAddMenuNote(restaurantId);
  const updateNote = useUpdateMenuNote(restaurantId);
  const deleteNote = useDeleteMenuNote(restaurantId);
  const { showSuccess, showError } = useSnackbar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const menuLanguages = useMenuLanguages(restaurantId);

  // The board's own copy, so a drag or a switch is on screen before the
  // server has answered.
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  // Numbered in one sequence with the categories (utils/menuLayout.ts).
  const [notes, setNotes] = useState<MenuNote[]>([]);
  const [editor, setEditor] = useState<EditorState>(CLOSED_EDITOR);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState>(CLOSED_NOTE_EDITOR);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DishFilter>('all');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [draggingCategory, setDraggingCategory] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [startingMenu, setStartingMenu] = useState(false);
  // Texts the open editor's saves brought onto the menu, and what of them
  // offered languages lack — asked for once the editor closes.
  const introduced = useRef<Set<string>>(new Set());
  const [translationGaps, setTranslationGaps] = useState<Map<string, string[]> | null>(
    null,
  );
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  // The latest board, for callbacks that finish after a request: reading it
  // from a closure would see the board as it was when the request started.
  const categoriesRef = useRef(categories);
  const notesRef = useRef(notes);
  useEffect(() => {
    categoriesRef.current = categories;
    notesRef.current = notes;
  }, [categories, notes]);

  useEffect(() => {
    if (menu.data) setCategories(menu.data);
  }, [menu.data]);

  useEffect(() => {
    if (menuNotes.data) setNotes(menuNotes.data);
  }, [menuNotes.data]);

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

  /** Glows a dish or a note for a moment and brings it into view on the board. */
  const highlight = useCallback((id: string) => {
    clearTimeout(highlightTimer.current);
    setHighlightedId(id);
    // A timer, not an animation: a hidden tab would freeze an animation on
    // its first frame (CLAUDE.md, trap 7).
    highlightTimer.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    setTimeout(() => {
      (
        document.getElementById(`dish-row-${id}`) ??
        document.getElementById(`builder-note-${id}`)
      )?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 60);
  }, []);

  const persistOrder = useCallback(
    (next: MenuCategory[], nextNotes: MenuNote[] = notesRef.current) => {
      reorderMenu.mutate(
        { categories: next, notes: nextNotes },
        { onError: (error) => showError(getApiErrorMessage(error)) },
      );
    },
    [reorderMenu, showError],
  );

  const handleBeforeCapture = (before: BeforeCapture) => {
    // Grabbing a category or a note folds every section to its header first,
    // so the whole menu fits on screen and the drop target is easy to see.
    if (
      categories.some((category) => category.id === before.draggableId) ||
      notes.some((note) => note.id === before.draggableId)
    ) {
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

    if (type === 'CATEGORY') {
      // Categories and notes share the board: move the section, then number
      // both lists again from the new order.
      const board = renumber(
        reorder(menuSections(categories, notes), source.index, destination.index),
      );
      setCategories(board.categories);
      setNotes(board.notes);
      persistOrder(board.categories, board.notes);
      showInPreview(result.draggableId);
      return;
    }

    const next = categories.map((category) => ({
      ...category,
      items: [...category.items],
    }));
    const from = next.find((category) => category.id === source.droppableId);
    const to = next.find((category) => category.id === destination.droppableId);
    if (!from || !to) return;
    const [moved] = from.items.splice(source.index, 1);
    to.items.splice(destination.index, 0, { ...moved, category_id: to.id });
    showInPreview(to.id);
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
            name: `${item.name} ${t('builder.copySuffix')}`,
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
            showSuccess(t('builder.copied', { name: item.name }));
          },
          onError: (error) => showError(getApiErrorMessage(error)),
        },
      );
    },
    [saveMenuItem, persistOrder, highlight, showInPreview, showSuccess, showError, t],
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
        showSuccess(t('builder.categoryAdded', { name: created.name }));
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
      for (const name of starterNames) {
        await addCategory.mutateAsync(name);
      }
      showSuccess(t('builder.started'));
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
        onSuccess: () =>
          showSuccess(t('builder.categoryDeleted', { name: category.name })),
        onError: (error) => {
          setCategories(snapshot);
          showError(getApiErrorMessage(error));
        },
      });
    } else if (deleteTarget.kind === 'note') {
      const { note } = deleteTarget;
      const notesSnapshot = notes;
      setNotes((previous) => previous.filter((existing) => existing.id !== note.id));
      deleteNote.mutate(note.id, {
        onSuccess: () => showSuccess(t('note.deleted')),
        onError: (error) => {
          setNotes(notesSnapshot);
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
        onSuccess: () => showSuccess(t('builder.dishDeleted', { name: item.name })),
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

  const openNewNote = (placement: 'start' | 'end') => {
    setNoteEditor({ open: true, note: null, placement });
  };

  const openEditNote = useCallback((note: MenuNote) => {
    setNoteEditor({ open: true, note, placement: 'start' });
  }, []);

  const handleRequestDeleteNote = useCallback((note: MenuNote) => {
    setDeleteTarget({ kind: 'note', note });
  }, []);

  const saveNote = (body: string, style: MenuNoteStyle) => {
    const { note, placement } = noteEditor;
    const landed = (saved: MenuNote) => {
      setNotes((previous) =>
        previous.some((existing) => existing.id === saved.id)
          ? previous.map((existing) => (existing.id === saved.id ? saved : existing))
          : [...previous, saved],
      );
      setNoteEditor((previous) => ({ ...previous, open: false }));
      highlight(saved.id);
      showInPreview(saved.id);
    };
    const onError = (error: unknown) => showError(getApiErrorMessage(error));
    if (note) {
      updateNote.mutate(
        { noteId: note.id, body, style },
        {
          onSuccess: (saved) => {
            landed(saved);
            showSuccess(t('note.saved'));
          },
          onError,
        },
      );
    } else {
      addNote.mutate(
        { body, at: placement, style },
        {
          onSuccess: (saved) => {
            landed(saved);
            showSuccess(
              placement === 'start' ? t('note.addedTop') : t('note.addedBottom'),
            );
          },
          onError,
        },
      );
    }
  };

  const handleSaved = (saved: MenuItem) => {
    setCategories((previous) => placeSaved(previous, saved));
    highlight(saved.id);
    showInPreview(saved.category_id);
    for (const text of introducedTexts(saved, editor.item)) introduced.current.add(text);
  };

  /**
   * Closes the dish editor and, when its saves brought texts some offered
   * language lacks, offers to translate them there and then. Asked of the
   * server afresh: the dishes were saved a moment ago. "Save and add next"
   * asks once, for the whole batch, when the editor finally closes.
   */
  const closeEditor = () => {
    setEditor((previous) => ({ ...previous, open: false }));
    const texts = introduced.current;
    introduced.current = new Set();
    if (texts.size === 0) return;
    queryClient
      .fetchQuery({
        queryKey: menuLanguagesQueryKey(restaurantId),
        queryFn: () => fetchMenuLanguages(restaurantId),
        staleTime: 0,
      })
      .then((data) => {
        const gaps = gapsFor(texts, data.untranslated);
        if (gaps.size > 0) setTranslationGaps(gaps);
      })
      // The count on "Languages" and the builder's chip still show the gap.
      .catch(() => undefined);
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
    return (starterTexts?.categories ?? []).filter(
      (name) => !taken.has(name.toLowerCase()),
    );
  }, [categories, starterTexts]);

  // Before the notes arrive the board waits too, so they do not pop in under
  // the owner's hand. Notes that fail to load (an API that predates them)
  // leave the categories to work on their own.
  const loading = menu.isLoading || menuNotes.isLoading;
  const isEmpty =
    !loading && !menu.isError && categories.length === 0 && notes.length === 0;

  // The board top to bottom. While a search or filter runs only categories
  // show — the notes hold no dishes — and nothing drags.
  const sections = useMemo(() => menuSections(categories, notes), [categories, notes]);

  const renderCategory = (category: MenuCategory, items: MenuItem[], index: number) => (
    <MenuCategorySection
      key={category.id}
      category={category}
      index={index}
      items={items}
      collapsed={draggingCategory || (!filtering && collapsed.has(category.id))}
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
  );

  const preview = (
    <LiveMenuPreview
      restaurantId={restaurantId}
      categories={categories}
      notes={notes}
      publicMenu={publicMenu.data}
      onOpenItem={openEditById}
      scrollRef={previewScrollRef}
      phone={sidePhone}
    />
  );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', pt: 4 }}>
      <Box
        sx={{
          display: 'grid',
          // The preview column is as wide as the fitted phone.
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) auto' },
          columnGap: 5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {/* Heading + tools */}
          <Stack
            direction="row"
            useFlexGap
            spacing={2}
            sx={{
              mb: 3,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}
          >
            {/* Wide enough for the subtitle on one line; the tools wrap under it
                when the column is narrower than that. */}
            <Box sx={{ minWidth: 0, flex: '1 1 520px' }}>
              <Typography variant="h4" component="h1">
                {t('nav.builder')}
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mt: 0.5 }}>
                {t('builder.subtitle')}
              </Typography>
            </Box>
            {!isEmpty && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center',
                  flexShrink: 0,
                  width: { xs: '100%', sm: 'auto' },
                }}
              >
                <TextField
                  size="small"
                  placeholder={t('builder.search')}
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
                    htmlInput: { 'aria-label': t('builder.search') },
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
                            aria-label={t('builder.clearSearch')}
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
                    {t('builder.preview')}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<NotesRoundedIcon />}
                  onClick={() => openNewNote('start')}
                  sx={{
                    flexShrink: 0,
                    display: { xs: 'none', sm: 'inline-flex' },
                    bgcolor: 'background.paper',
                  }}
                >
                  {t('builder.newNote')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => setAddCategoryOpen(true)}
                  sx={{ flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  {t('builder.newCategory')}
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
                  {t('common.retry')}
                </Button>
              }
            >
              {getApiErrorMessage(menu.error)}
            </Alert>
          )}

          {loading ? (
            <BoardSkeleton />
          ) : isEmpty ? (
            <MenuStarter
              names={starterNames}
              busy={startingMenu || starterNames.length === 0}
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
                  untranslated={untranslatedDishes(
                    categories,
                    menuLanguages.data?.untranslated,
                  )}
                  onTranslate={() =>
                    navigate(`/panel/${restaurantId}/dictionary?translate=1`)
                  }
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
                      {t('builder.showAll')}
                    </Button>
                  }
                >
                  {visible.length === 0 ? t('builder.noMatch') : t('builder.filtered')}
                </Alert>
              )}

              <DragDropContext
                onBeforeCapture={handleBeforeCapture}
                onDragEnd={handleDragEnd}
              >
                <Droppable droppableId="board" type="CATEGORY">
                  {(provided: DroppableProvided) => (
                    <Box ref={provided.innerRef} {...provided.droppableProps}>
                      {filtering
                        ? visible.map(({ category, items }, index) =>
                            renderCategory(category, items, index),
                          )
                        : sections.map((section, index) =>
                            section.kind === 'note' ? (
                              <MenuNoteBlock
                                key={section.id}
                                note={section.note}
                                index={index}
                                highlighted={section.id === highlightedId}
                                onEdit={openEditNote}
                                onRequestDelete={handleRequestDeleteNote}
                              />
                            ) : (
                              renderCategory(
                                section.category,
                                section.category.items,
                                index,
                              )
                            ),
                          )}
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
                  onAddNote={() => openNewNote('end')}
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
          aria-label={t('builder.previewDialog')}
          slotProps={{ paper: { sx: { p: 2.5, m: 1.5 } } }}
        >
          <LiveMenuPreview
            restaurantId={restaurantId}
            categories={categories}
            notes={notes}
            publicMenu={publicMenu.data}
            onOpenItem={openEditById}
            phone={dialogPhone}
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
        onClose={closeEditor}
        onSaved={handleSaved}
        onRequestDelete={handleRequestDeleteItem}
      />

      <DishTranslationDialog
        restaurantId={restaurantId}
        gaps={translationGaps}
        onClose={() => setTranslationGaps(null)}
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

      <MenuNoteDialog
        open={noteEditor.open}
        note={noteEditor.note}
        placement={noteEditor.placement}
        menuTheme={publicMenu.data?.restaurant.theme}
        templates={starterTexts?.notes}
        saving={addNote.isPending || updateNote.isPending}
        onClose={() => setNoteEditor((previous) => ({ ...previous, open: false }))}
        onSave={saveNote}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === 'item'
            ? t('builder.deleteDishTitle')
            : deleteTarget?.kind === 'note'
              ? t('note.deleteTitle')
              : t('builder.deleteCategoryTitle')
        }
        description={
          deleteTarget?.kind === 'category'
            ? t('builder.deleteCategoryBody', { name: deleteTarget.category.name })
            : deleteTarget?.kind === 'item'
              ? t('builder.deleteDishBody', { name: deleteTarget.item.name })
              : deleteTarget?.kind === 'note'
                ? t('note.deleteBody')
                : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
