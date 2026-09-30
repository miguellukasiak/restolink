import { api } from './api';
import type {
  MenuCategory,
  MenuItem,
  MenuItemRequest,
  MenuNote,
  MenuNoteStyle,
  RestaurantPanelInfo,
  RestaurantThemeUpdate,
} from '../types';
import { menuSections } from '../utils/menuLayout';

/** GET /api/v1/restaurants/{restaurantId} — restaurant details for the panel header. */
export async function fetchRestaurantPanelInfo(
  restaurantId: string,
): Promise<RestaurantPanelInfo> {
  const { data } = await api.get<RestaurantPanelInfo>(
    `/api/v1/restaurants/${restaurantId}`,
  );
  return data;
}

/** PUT /api/v1/restaurants/{restaurantId}/theme — saves visual brand settings. */
export async function updateRestaurantTheme(
  restaurantId: string,
  payload: RestaurantThemeUpdate,
): Promise<void> {
  await api.put(`/api/v1/restaurants/${restaurantId}/theme`, payload);
}

/** GET /api/v1/restaurants/{restaurantId}/menu/categories — menu with nested items. */
export async function fetchMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
  const { data } = await api.get<MenuCategory[]>(
    `/api/v1/restaurants/${restaurantId}/menu/categories`,
  );
  return [...data].sort((a, b) => a.order - b.order);
}

/** POST /api/v1/restaurants/{restaurantId}/menu/categories — creates a category (201). */
export async function createMenuCategory(
  restaurantId: string,
  name: string,
): Promise<MenuCategory> {
  const { data } = await api.post<MenuCategory>(
    `/api/v1/restaurants/${restaurantId}/menu/categories`,
    { name },
  );
  return data;
}

/** PATCH /api/v1/restaurants/{restaurantId}/menu/categories/{categoryId} — rename. */
export async function updateMenuCategory(
  restaurantId: string,
  categoryId: string,
  name: string,
): Promise<MenuCategory> {
  const { data } = await api.patch<MenuCategory>(
    `/api/v1/restaurants/${restaurantId}/menu/categories/${categoryId}`,
    { name },
  );
  return data;
}

/** DELETE /api/v1/restaurants/{restaurantId}/menu/categories/{categoryId} (204). */
export async function deleteMenuCategory(
  restaurantId: string,
  categoryId: string,
): Promise<void> {
  await api.delete(
    `/api/v1/restaurants/${restaurantId}/menu/categories/${categoryId}`,
  );
}

/** DELETE /api/v1/restaurants/{restaurantId}/menu/items/{itemId} (204). */
export async function deleteMenuItem(
  restaurantId: string,
  itemId: string,
): Promise<void> {
  await api.delete(`/api/v1/restaurants/${restaurantId}/menu/items/${itemId}`);
}

/**
 * POST /api/v1/restaurants/{restaurantId}/menu/items — saves a dish.
 * Passing `itemId` includes it in the body so the backend can upsert an
 * existing dish; omitted for brand-new dishes. Resolves to the saved dish, so
 * a new one's id is known without waiting for the menu to be re-read.
 */
export async function saveMenuItem(
  restaurantId: string,
  payload: MenuItemRequest,
  itemId?: string,
): Promise<MenuItem> {
  const { data } = await api.post<MenuItem>(
    `/api/v1/restaurants/${restaurantId}/menu/items`,
    {
      ...payload,
      ...(itemId ? { id: itemId } : {}),
    },
  );
  return data;
}

/**
 * PUT /api/v1/restaurants/{restaurantId}/menu/order (204) — saves the board
 * after a drag: category order, dish order, and dishes moved between
 * categories. Sends the whole layout rather than the single move, so a late
 * or repeated request still leaves the order the owner last saw.
 */
export async function reorderMenu(
  restaurantId: string,
  categories: MenuCategory[],
  notes: MenuNote[] = [],
): Promise<void> {
  await api.put(`/api/v1/restaurants/${restaurantId}/menu/order`, {
    categories: categories.map((category) => ({
      id: category.id,
      item_ids: category.items.map((item) => item.id),
    })),
    // Every section top to bottom, notes among the categories.
    layout: menuSections(categories, notes).map((section) => section.id),
  });
}

const notesUrl = (restaurantId: string) =>
  `/api/v1/restaurants/${restaurantId}/menu/notes`;

/** GET …/menu/notes — the notes, each placed by `order` among the categories. */
export async function fetchMenuNotes(restaurantId: string): Promise<MenuNote[]> {
  const { data } = await api.get<MenuNote[]>(notesUrl(restaurantId));
  return [...data].sort((a, b) => a.order - b.order);
}

/** POST …/menu/notes — adds a note at the top or the bottom of the menu. */
export async function createMenuNote(
  restaurantId: string,
  body: string,
  at: 'start' | 'end',
  style: MenuNoteStyle,
): Promise<MenuNote> {
  const { data } = await api.post<MenuNote>(notesUrl(restaurantId), { body, at, style });
  return data;
}

/** PATCH …/menu/notes/{noteId} — rewrites a note's text and look. */
export async function updateMenuNote(
  restaurantId: string,
  noteId: string,
  body: string,
  style: MenuNoteStyle,
): Promise<MenuNote> {
  const { data } = await api.patch<MenuNote>(`${notesUrl(restaurantId)}/${noteId}`, {
    body,
    style,
  });
  return data;
}

/** DELETE …/menu/notes/{noteId} */
export async function deleteMenuNote(restaurantId: string, noteId: string): Promise<void> {
  await api.delete(`${notesUrl(restaurantId)}/${noteId}`);
}
