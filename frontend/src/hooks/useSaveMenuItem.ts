import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveMenuItem } from '../services/menuService';
import { menuQueryKeys } from './useMenu';
import type { MenuItemRequest } from '../types';

interface SaveMenuItemVariables {
  payload: MenuItemRequest;
  /** Present when editing an existing dish; absent when creating a new one. */
  itemId?: string;
}

/** Saves a dish and refreshes the restaurant's menu on success. */
export function useSaveMenuItem(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload, itemId }: SaveMenuItemVariables) =>
      saveMenuItem(restaurantId, payload, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: menuQueryKeys.categories(restaurantId),
      });
    },
  });
}
