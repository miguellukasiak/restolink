import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  createAdmin,
  fetchAdmins,
  fetchAuditLogs,
  impersonateRestaurant,
  revokeAdmin,
} from '../services/hqService';
import { expiresAtFrom, saveRestaurantSession } from '../services/authStorage';

export const hqQueryKeys = {
  admins: ['hq', 'admins'] as const,
  auditLogs: (page: number, limit: number) =>
    ['hq', 'audit-logs', { page, limit }] as const,
};

/** Every HQ account. */
export function useAdmins() {
  return useQuery({
    queryKey: hqQueryKeys.admins,
    queryFn: fetchAdmins,
    staleTime: 30_000,
  });
}

/**
 * Adds an HQ account.
 *
 * Both lists are invalidated on success: the team table obviously, and the
 * audit trail because the server wrote an entry for this — leaving it stale
 * would show a log that is missing the action the operator just performed.
 */
export function useCreateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      createAdmin(email, password),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hqQueryKeys.admins });
      void queryClient.invalidateQueries({ queryKey: ['hq', 'audit-logs'] });
    },
  });
}

/** Revokes HQ access, keeping the account. */
export function useRevokeAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adminId: string) => revokeAdmin(adminId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hqQueryKeys.admins });
      void queryClient.invalidateQueries({ queryKey: ['hq', 'audit-logs'] });
    },
  });
}

/** The audit trail, server-paginated. */
export function useAuditLogs(page: number, limit: number) {
  return useQuery({
    queryKey: hqQueryKeys.auditLogs(page, limit),
    queryFn: () => fetchAuditLogs(page, limit),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/**
 * Opens a support session inside a restaurant's panel.
 *
 * The returned token is stored as the restaurant session and flagged
 * `impersonated`, which is what puts the warning strip across the panel. The
 * *admin* session is left untouched under its own key, so the way back to HQ is
 * still open — signing into a customer's account must not sign you out of your
 * own.
 *
 * The React Query cache is cleared first. It holds the HQ restaurant list and
 * whatever panel data was last viewed, and carrying that into a different
 * account's dashboard would show one restaurant's menu under another's name.
 */
export function useImpersonate() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (restaurantId: string) => impersonateRestaurant(restaurantId),
    onSuccess: (result) => {
      saveRestaurantSession({
        token: result.access_token,
        expiresAt: expiresAtFrom(result.expires_in),
        restaurantId: result.restaurant_id,
        restaurantName: result.restaurant_name,
        impersonated: true,
      });
      queryClient.clear();
      navigate(`/panel/${result.restaurant_id}/menu`);
    },
  });
}
