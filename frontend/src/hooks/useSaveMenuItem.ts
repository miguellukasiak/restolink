import { useMutation } from '@tanstack/react-query';
import { saveMenuItem } from '../services/menuService';
import { writesTo } from '../services/cacheSync';
import type { MenuItemRequest } from '../types';

interface SaveMenuItemVariables {
  payload: MenuItemRequest;
  /** Present when editing an existing dish; absent when creating a new one. */
  itemId?: string;
}

/** Saves a dish and refreshes the restaurant's menu on success. */
export function useSaveMenuItem(restaurantId: string) {
  return useMutation({
    mutationFn: ({ payload, itemId }: SaveMenuItemVariables) =>
      saveMenuItem(restaurantId, payload, itemId),
    // Refreshes the builder, the previews, "Languages" and the guest menu.
    meta: writesTo(restaurantId, ['menu']),
  });
}
