import { api } from './api';
import type {
  MenuCategory,
  MenuItemRequest,
  RestaurantPanelInfo,
  RestaurantThemeUpdate,
} from '../types';

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

/**
 * POST /api/v1/restaurants/{restaurantId}/menu/items — saves a dish.
 * Passing `itemId` includes it in the body so the backend can upsert an
 * existing dish; omitted for brand-new dishes (contract: 201).
 */
export async function saveMenuItem(
  restaurantId: string,
  payload: MenuItemRequest,
  itemId?: string,
): Promise<void> {
  await api.post(`/api/v1/restaurants/${restaurantId}/menu/items`, {
    ...payload,
    ...(itemId ? { id: itemId } : {}),
  });
}
