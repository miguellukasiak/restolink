import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdminAuth, RequireRestaurantAuth } from './components/auth/RequireAuth';
import { AdminLayout } from './components/layout/AdminLayout';
import { RestaurantPanelLayout } from './components/layout/RestaurantPanelLayout';
import { RestaurantThemeProvider } from './components/public/RestaurantThemeProvider';
import { RestaurantsPage } from './pages/RestaurantsPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { HqAccessPage } from './pages/auth/HqAccessPage';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { MenuBuilderPage } from './pages/panel/MenuBuilderPage';
import { QrGeneratorPage } from './pages/panel/QrGeneratorPage';
import { AppearancePage } from './pages/panel/AppearancePage';
import { DictionaryPage } from './pages/panel/DictionaryPage';
import { GoogleReviewsPage } from './pages/panel/GoogleReviewsPage';
import { PublicMenuPage } from './pages/public/PublicMenuPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The app root now belongs to restaurant owners. It used to send
            everyone to /admin/restaurants, which since that route became
            admin-only would bounce every visitor onto the unlisted admin
            door. */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Credentials — reachable without a session, by definition. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/hq-access" element={<HqAccessPage />} />

        {/* Admin ecosystem — super-admin token only. */}
        <Route element={<RequireAdminAuth />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="restaurants" replace />} />
            <Route path="restaurants" element={<RestaurantsPage />} />
          </Route>
        </Route>

        {/* Restaurant owner ecosystem — the guard also checks that the id in
            the URL is the one the session belongs to. */}
        <Route element={<RequireRestaurantAuth />}>
          <Route path="/panel/:restaurantId" element={<RestaurantPanelLayout />}>
            <Route index element={<Navigate to="menu" replace />} />
            <Route path="menu" element={<MenuBuilderPage />} />
            <Route path="qr" element={<QrGeneratorPage />} />
            <Route path="dictionary" element={<DictionaryPage />} />
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

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
