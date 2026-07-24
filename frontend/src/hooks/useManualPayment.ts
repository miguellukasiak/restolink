import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createManualPayment } from '../services/restaurantService';
import { restaurantsQueryKeys } from './useRestaurants';
import type { ManualPaymentRequest } from '../types';

interface ManualPaymentVariables {
  restaurantId: string;
  payload: ManualPaymentRequest;
}

/**
 * Books a manual payment for a restaurant and, on success, invalidates every
 * restaurants list query so the DataGrid refreshes automatically.
 */
export function useManualPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ restaurantId, payload }: ManualPaymentVariables) =>
      createManualPayment(restaurantId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restaurantsQueryKeys.all });
    },
  });
}
