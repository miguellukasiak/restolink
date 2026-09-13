import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { getAdminSession, getRestaurantSession } from '../../services/authStorage';

/**
 * Route guards.
 *
 * These are a *convenience*, not the security boundary — every protected
 * endpoint is enforced server-side, and a determined visitor can always flip a
 * flag in devtools. Their job is to send a signed-out user somewhere useful
 * instead of letting them watch a panel full of failed requests.
 */

function buildLoginPath(base: string, attempted: string): string {
  return `${base}?next=${encodeURIComponent(attempted)}`;
}

/** Wraps `/panel/:restaurantId`. */
export function RequireRestaurantAuth() {
  const location = useLocation();
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const session = getRestaurantSession();

  if (!session) {
    return (
      <Navigate
        to={buildLoginPath('/login', location.pathname + location.search)}
        replace
      />
    );
  }

  // Signed in, but at someone else's panel. The API would answer 404 for every
  // request on that page; redirecting to their own panel is both friendlier
  // and makes it obvious the URL is not a way in.
  if (restaurantId && restaurantId !== session.restaurantId) {
    return <Navigate to={`/panel/${session.restaurantId}`} replace />;
  }

  return <Outlet />;
}

/** Wraps `/admin/*`. */
export function RequireAdminAuth() {
  const location = useLocation();
  const session = getAdminSession();

  if (!session) {
    return (
      <Navigate
        to={buildLoginPath('/hq-access', location.pathname + location.search)}
        replace
      />
    );
  }

  return <Outlet />;
}
