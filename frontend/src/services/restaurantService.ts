import { api } from './api';
import type {
  CreateRestaurantRequest,
  ManualPaymentRequest,
  ManualPaymentResponse,
  RestaurantListItem,
  RestaurantListParams,
  RestaurantListResponse,
} from '../types';

/** GET /api/v1/admin/restaurants — paginated restaurant accounts. */
export async function fetchRestaurants(
  params: RestaurantListParams,
): Promise<RestaurantListResponse> {
  const { data } = await api.get<RestaurantListResponse>('/api/v1/admin/restaurants', {
    params,
  });
  return data;
}

/** POST /api/v1/admin/restaurants — creates a new restaurant account (201). */
export async function createRestaurant(
  payload: CreateRestaurantRequest,
): Promise<RestaurantListItem> {
  const { data } = await api.post<RestaurantListItem>('/api/v1/admin/restaurants', payload);
  return data;
}

/** POST /api/v1/admin/restaurants/{id}/manual-payment — books a manual transfer. */
export async function createManualPayment(
  restaurantId: string,
  payload: ManualPaymentRequest,
): Promise<ManualPaymentResponse> {
  const { data } = await api.post<ManualPaymentResponse>(
    `/api/v1/admin/restaurants/${restaurantId}/manual-payment`,
    payload,
  );
  return data;
}
