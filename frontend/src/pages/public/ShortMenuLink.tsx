import { Navigate, useParams } from 'react-router-dom';
import { restaurantIdFromShortCode } from '../../utils/menuLink';

/**
 * `/m/:code` — the short link printed in QR codes (see utils/menuLink.ts).
 *
 * Expands the code into the restaurant id and hands over to the ordinary menu
 * route, so the menu itself only ever lives at one address. The printed link
 * is upper-case; the route matches regardless and the code is decoded
 * case-insensitively. Something that is not a code still goes to the menu
 * route, which answers it with its own "not found".
 */
export function ShortMenuLink() {
  const { code = '' } = useParams<{ code: string }>();
  const restaurantId = restaurantIdFromShortCode(code);
  return <Navigate to={`/menu/${restaurantId ?? encodeURIComponent(code)}`} replace />;
}
