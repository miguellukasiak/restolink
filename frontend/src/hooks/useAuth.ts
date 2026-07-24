import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UserRole = 'RESTAURATEUR' | 'ADMIN';

interface AuthState {
  role: UserRole;
}

/**
 * Mocked authorization. Defaults every user to `RESTAURATEUR`.
 *
 * For testing, an `?role=ADMIN` query param temporarily elevates the session so
 * the "Panel admina" back-link stays reachable — this is a stand-in until real
 * auth (token/claims) is wired in.
 */
export function useAuth(): AuthState {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const role: UserRole =
      searchParams.get('role') === 'ADMIN' ? 'ADMIN' : 'RESTAURATEUR';
    return { role };
  }, [searchParams]);
}
