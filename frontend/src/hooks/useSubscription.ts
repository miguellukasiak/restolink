import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCheckoutSession } from '../services/subscriptionService';
import { restaurantInfoQueryKeys } from './useRestaurantInfo';

/**
 * Starts a Stripe Checkout and hands the browser over to it.
 *
 * There is no success callback: on success this navigates away, so any state
 * set afterwards would belong to a page that is being torn down. The loading
 * state therefore stays on until either the redirect happens or the call fails.
 */
export function useCheckout() {
  return useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      // A full navigation, not the router: the destination is Stripe's domain.
      window.location.href = data.checkout_url;
    },
  });
}

/** How many times to re-check after returning from a successful checkout. */
const CONFIRM_ATTEMPTS = 4;
const CONFIRM_DELAY_MS = 2000;

export type CheckoutOutcome = 'success' | 'cancelled' | null;

interface CheckoutReturn {
  outcome: CheckoutOutcome;
  /** True while re-checking whether the webhook has landed. */
  confirming: boolean;
}

/**
 * Handles the return trip from Stripe.
 *
 * The subtlety worth knowing: the owner can arrive back here *before* Stripe
 * delivers the webhook that actually grants access. A single refetch would then
 * show the old PENDING status and the warning banner would stay up, looking
 * like the payment failed. So this re-checks a few times over several seconds,
 * stopping as soon as the panel data reflects the new status.
 *
 * The `checkout` query flag is stripped once read, so a refresh does not
 * re-announce a payment from ten minutes ago.
 */
export function useCheckoutReturn(
  restaurantId: string,
  isActive: boolean,
): CheckoutReturn {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [outcome, setOutcome] = useState<CheckoutOutcome>(null);
  const [confirming, setConfirming] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const flag = searchParams.get('checkout');
    if (flag !== 'success' && flag !== 'cancelled') return;

    handled.current = true;
    setOutcome(flag);

    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });

    if (flag === 'success') setConfirming(true);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (outcome !== 'success' || !confirming || !restaurantId) return;

    // Already active: the webhook beat the redirect, which is the common case.
    if (isActive) {
      setConfirming(false);
      return;
    }

    let attempts = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      void queryClient.invalidateQueries({
        queryKey: restaurantInfoQueryKeys.detail(restaurantId),
      });
      if (attempts >= CONFIRM_ATTEMPTS) {
        setConfirming(false);
        return;
      }
      timer = window.setTimeout(tick, CONFIRM_DELAY_MS);
    };

    let timer = window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [outcome, confirming, isActive, restaurantId, queryClient]);

  return { outcome, confirming };
}
