import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateActivationLink,
  sendActivationLink,
  updateRestaurant,
  type RestaurantUpdateRequest,
} from '../services/restaurantService';
import { restaurantsQueryKeys } from './useRestaurants';

/** Invalidated together: every one of these writes an audit entry. */
function invalidateHq(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: restaurantsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['hq', 'audit-logs'] });
}

/** Corrects a restaurant's basic details. */
export function useUpdateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      restaurantId,
      payload,
    }: {
      restaurantId: string;
      payload: RestaurantUpdateRequest;
    }) => updateRestaurant(restaurantId, payload),
    onSuccess: () => invalidateHq(queryClient),
  });
}

/** Re-sends the welcome email with a fresh link. */
export function useSendActivationLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (restaurantId: string) => sendActivationLink(restaurantId),
    onSuccess: () => invalidateHq(queryClient),
  });
}

/**
 * Issues a link without emailing it.
 *
 * Every call mints a *new* token and voids the previous one, so this is not a
 * "show me the link" read — pressing it twice invalidates the copy an operator
 * may already have pasted into a message. Callers should treat the result as
 * the only live link for that restaurant.
 */
export function useGenerateActivationLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (restaurantId: string) => generateActivationLink(restaurantId),
    onSuccess: () => invalidateHq(queryClient),
  });
}

/**
 * Copies text, reporting whether it worked.
 *
 * The Clipboard API needs a secure context and permission, and returns a
 * rejected promise when it does not have them. A rescue tool that silently
 * fails to copy the one link an operator needs is worse than one that says so,
 * so the caller falls back to showing the link for manual selection.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
