import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { RestaurantPanelLayout } from './components/layout/RestaurantPanelLayout';
import { RestaurantThemeProvider } from './components/public/RestaurantThemeProvider';
import { RestaurantsPage } from './pages/RestaurantsPage';
import { MenuBuilderPage } from './pages/panel/MenuBuilderPage';
import { QrGeneratorPage } from './pages/panel/QrGeneratorPage';
import { SettingsPage } from './pages/panel/SettingsPage';
import { PublicMenuPage } from './pages/public/PublicMenuPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/restaurants" replace />} />

        {/* Admin ecosystem */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="restaurants" replace />} />
          <Route path="restaurants" element={<RestaurantsPage />} />
        </Route>

        {/* Restaurant owner ecosystem */}
        <Route path="/panel/:restaurantId" element={<RestaurantPanelLayout />}>
          <Route index element={<Navigate to="menu" replace />} />
          <Route path="menu" element={<MenuBuilderPage />} />
          <Route path="qr" element={<QrGeneratorPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Public client ecosystem — isolated, dynamically themed */}
        <Route
          path="/menu/:restaurantId"
          element={
            <RestaurantThemeProvider>
              <PublicMenuPage />
            </RestaurantThemeProvider>
          }
        />

        <Route path="*" element={<Navigate to="/admin/restaurants" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
