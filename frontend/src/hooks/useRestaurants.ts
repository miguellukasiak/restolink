import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GridPaginationModel } from '@mui/x-data-grid';
import { fetchRestaurants } from '../services/restaurantService';

export const restaurantsQueryKeys = {
  all: ['restaurants'] as const,
  list: (page: number, limit: number) => ['restaurants', 'list', { page, limit }] as const,
};

/**
 * Server-side paginated restaurants list.
 *
 * Accepts the DataGrid pagination model (0-based `page`) and translates it to
 * the API contract (1-based `page`, `limit`). `keepPreviousData` keeps the
 * current rows on screen while the next page loads, so the grid never flashes.
 */
export function useRestaurants(paginationModel: GridPaginationModel) {
  const page = paginationModel.page + 1;
  const limit = paginationModel.pageSize;

  return useQuery({
    queryKey: restaurantsQueryKeys.list(page, limit),
    queryFn: () => fetchRestaurants({ page, limit }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
