import { isPast } from 'date-fns';
import type { RestaurantStatus } from '../types';

/** Effective access derived from raw status + subscription expiry. */
export type AccessState = 'ACTIVE' | 'PENDING' | 'BLOCKED';

/**
 * Resolves what a viewer is allowed to see.
 *
 * Business rule: a `BLOCKED` restaurant is always blocked; a `PENDING` one is
 * pending; an `ACTIVE` one is only truly active while its subscription is still
 * valid — once `subscription_valid_until` is in the past it is treated as
 * expired (i.e. `BLOCKED`), matching the "Zablokowana / expired" state.
 */
export function resolveAccessState(
  status: RestaurantStatus,
  subscriptionValidUntil: string | null,
): AccessState {
  if (status === 'BLOCKED') return 'BLOCKED';
  if (status === 'PENDING') return 'PENDING';
  if (subscriptionValidUntil && isPast(new Date(subscriptionValidUntil))) {
    return 'BLOCKED';
  }
  return 'ACTIVE';
}

/** Placeholder toast shown by the payment CTAs until Stripe is wired up. */
export const PAYMENT_PENDING_TOAST = 'Payment gateway integration pending';
