import { api } from './api';

export interface CheckoutSessionResponse {
  /** Stripe-hosted page. The browser is sent here; we never render it. */
  checkout_url: string;
}

/**
 * POST /api/v1/subscriptions/create-checkout-session
 *
 * Takes no arguments on purpose. The restaurant being subscribed comes from the
 * bearer token server-side — a body naming the account would let one owner
 * start a checkout against another's subscription.
 */
export async function createCheckoutSession(): Promise<CheckoutSessionResponse> {
  const { data } = await api.post<CheckoutSessionResponse>(
    '/api/v1/subscriptions/create-checkout-session',
  );
  return data;
}
