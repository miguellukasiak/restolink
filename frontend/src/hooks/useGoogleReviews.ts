import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchGoogleReviews,
  saveGooglePlaceId,
  type GoogleReviewsResponse,
} from '../services/googleMapsService';

export const googleReviewsQueryKeys = {
  detail: (restaurantId: string) => ['google-reviews', restaurantId] as const,
};

/**
 * The Google reviews dashboard.
 *
 * `retry: false` on purpose. The three failures this endpoint actually
 * produces — no API key configured (503), a Place ID Google does not know
 * (400), and Google being unreachable (502, already answered from a stale
 * snapshot when one exists) — are all settled answers. Retrying them three
 * times only delays the message the owner needs to read by several seconds.
 * Cold starts are already handled one level down, in the Axios interceptor.
 */
export function useGoogleReviews(restaurantId: string) {
  return useQuery({
    queryKey: googleReviewsQueryKeys.detail(restaurantId),
    queryFn: () => fetchGoogleReviews(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });
}

/** Connects a listing, or disconnects it when given an empty string. */
export function useSaveGooglePlaceId(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (placeId: string) => saveGooglePlaceId(restaurantId, placeId),
    onSuccess: (data: GoogleReviewsResponse) => {
      // The PUT already returns the dashboard, so seed the cache with it
      // rather than refetching what we were just handed — which for a newly
      // connected listing would mean a second Google call.
      queryClient.setQueryData(googleReviewsQueryKeys.detail(restaurantId), data);
    },
  });
}
