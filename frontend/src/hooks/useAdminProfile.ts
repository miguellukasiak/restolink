import { useQuery } from '@tanstack/react-query';
import { fetchAdminProfile } from '../services/authService';
import { getAdminSession } from '../services/authStorage';

export const adminProfileQueryKeys = {
  me: ['admin-profile'] as const,
};

/**
 * The signed-in HQ account, re-read from the server.
 *
 * The email is already in local storage from sign-in, so this is not about
 * fetching a string — it is a live re-check of the `is_superadmin` flag. Local
 * storage says whatever it said when the session was created; an account
 * demoted since then would keep rendering the panel shell until a request
 * happened to fail. Asking the server on every admin page load closes that
 * window, and the API refuses the request outright if the flag is gone.
 */
export function useAdminProfile() {
  return useQuery({
    queryKey: adminProfileQueryKeys.me,
    queryFn: fetchAdminProfile,
    enabled: Boolean(getAdminSession()),
    retry: false,
  });
}
