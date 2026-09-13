import { api } from './api';

/** One Google review, already trimmed server-side to what the panel draws. */
export interface GoogleReview {
  author_name: string;
  profile_photo_url: string | null;
  rating: number;
  text: string;
  /** Localised by Google itself — e.g. "2 tygodnie temu". */
  relative_time_description: string;
  /** Epoch seconds; the server has already sorted on it. */
  time: number;
}

/**
 * The dashboard's whole state in one object.
 *
 * `configured` is what the page switches on. It comes back as data rather than
 * as a 404 because "has not pasted a Place ID yet" is a normal state for a new
 * restaurant, not a failure — routing it through the error path would greet an
 * owner with a red alert for something they simply have not done.
 */
export interface GoogleReviewsResponse {
  configured: boolean;
  place_id: string | null;
  /** Null for a listing nobody has rated yet — not the same as 0. */
  rating: number | null;
  total_ratings: number;
  reviews: GoogleReview[];
  /** ISO timestamp of the last pull from Google; null before the first one. */
  synced_at: string | null;
}

const base = (restaurantId: string) => `/api/v1/panel/${restaurantId}`;

/**
 * GET — rating, review count and the five most recent reviews.
 *
 * Served from a 24-hour server-side cache, so calling this repeatedly is free;
 * only the first request of the day reaches Google.
 */
export async function fetchGoogleReviews(
  restaurantId: string,
): Promise<GoogleReviewsResponse> {
  const { data } = await api.get<GoogleReviewsResponse>(
    `${base(restaurantId)}/google-reviews`,
  );
  return data;
}

/**
 * PUT — connect a listing, or disconnect it by sending an empty string.
 *
 * Answers with the dashboard state, so the page can switch out of the setup
 * screen on this one response instead of saving and then asking again.
 */
export async function saveGooglePlaceId(
  restaurantId: string,
  placeId: string,
): Promise<GoogleReviewsResponse> {
  const { data } = await api.put<GoogleReviewsResponse>(
    `${base(restaurantId)}/google-place`,
    { google_place_id: placeId },
  );
  return data;
}
