import { api } from './api';
import type { PublicMenuResponse } from '../types';

/** GET /api/v1/public/restaurants/{restaurantId}/menu — full public menu + theme. */
export async function fetchPublicMenu(restaurantId: string): Promise<PublicMenuResponse> {
  const { data } = await api.get<PublicMenuResponse>(
    `/api/v1/public/restaurants/${restaurantId}/menu`,
  );
  return {
    ...data,
    categories: [...data.categories].sort((a, b) => a.order - b.order),
  };
}
