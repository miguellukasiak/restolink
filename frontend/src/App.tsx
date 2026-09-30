import { Suspense, lazy } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom';
import { RequireAdminAuth, RequireRestaurantAuth } from './components/auth/RequireAuth';
import { AdminLayout } from './components/layout/AdminLayout';
import { RestaurantPanelLayout } from './components/layout/RestaurantPanelLayout';
import { RestaurantThemeProvider } from './components/public/RestaurantThemeProvider';
import { RestaurantsPage } from './pages/RestaurantsPage';
import { HqTeamPage } from './pages/admin/HqTeamPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { HqAccessPage } from './pages/auth/HqAccessPage';
import { LoginPage } from './pages/auth/LoginPage';
import { ActivatePage } from './pages/auth/ActivatePage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { MenuBuilderPage } from './pages/panel/MenuBuilderPage';
import { QrGeneratorPage } from './pages/panel/QrGeneratorPage';
import { AppearancePage } from './pages/panel/AppearancePage';
import { GoogleReviewsPage } from './pages/panel/GoogleReviewsPage';
import { PublicMenuPage } from './pages/public/PublicMenuPage';
import { ShortMenuLink } from './pages/public/ShortMenuLink';
import { PageLoader } from './components/feedback/PageLoader';

// Split off: it carries the world map, which no other screen needs.
const LanguagesPage = lazy(() => import('./pages/panel/LanguagesPage'));

/** What every route renders inside. */
function Root() {
  return (
    // The guest interface loads a language's strings the first time it is
    // needed (i18n/index.ts), and react-i18next suspends while it does.
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}

// A data router rather than <BrowserRouter>: pages holding unsaved edits ask
// before the owner navigates away (useUnsavedChangesGuard), and `useBlocker`
// exists only on a data router.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Root />}>
      {/* The app root now belongs to restaurant owners. It used to send
            everyone to /admin/restaurants, which since that route became
            admin-only would bounce every visitor onto the unlisted admin
            door. */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Credentials — reachable without a session, by definition. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Where the welcome email lands. Open by definition — the whole
            point is that the owner has no password yet. */}
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/hq-access" element={<HqAccessPage />} />

      {/* Admin ecosystem — super-admin token only. */}
      <Route element={<RequireAdminAuth />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="restaurants" replace />} />
          <Route path="restaurants" element={<RestaurantsPage />} />
          <Route path="team" element={<HqTeamPage />} />
          <Route path="logs" element={<AuditLogPage />} />
        </Route>
      </Route>

      {/* Restaurant owner ecosystem — the guard also checks that the id in
            the URL is the one the session belongs to. */}
      <Route element={<RequireRestaurantAuth />}>
        <Route path="/panel/:restaurantId" element={<RestaurantPanelLayout />}>
          <Route index element={<Navigate to="menu" replace />} />
          <Route path="menu" element={<MenuBuilderPage />} />
          <Route path="qr" element={<QrGeneratorPage />} />
          <Route
            path="dictionary"
            element={
              <Suspense fallback={<PageLoader />}>
                <LanguagesPage />
              </Suspense>
            }
          />
          <Route path="google" element={<GoogleReviewsPage />} />
          <Route path="settings" element={<AppearancePage />} />
        </Route>
      </Route>

      {/* Public client ecosystem — isolated, dynamically themed, and
            deliberately open: a guest scanning a QR code has no account. */}
      <Route
        path="/menu/:restaurantId"
        element={
          <RestaurantThemeProvider>
            <PublicMenuPage />
          </RestaurantThemeProvider>
        }
      />

      {/* The short form printed in QR codes; expands to the route above. */}
      <Route path="/m/:code" element={<ShortMenuLink />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Route>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}
