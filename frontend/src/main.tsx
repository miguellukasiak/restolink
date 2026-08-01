import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import App from './App';
import './i18n';
import { theme } from './theme';
import { SnackbarProvider } from './components/feedback/SnackbarProvider';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays "fresh" for 5 minutes, so moving between panel tabs
      // (Kreator menu / Kody QR / Wygląd menu) serves the cached result
      // instantly — no refetch, no loading skeleton on client-side navigation.
      staleTime: 1000 * 60 * 5,
      // Keep unused query data around for 30 minutes after the last screen
      // using it unmounts, so returning to a tab still hits a warm cache
      // (never falls back to the `isPending` skeleton) even after a detour.
      gcTime: 1000 * 60 * 30,
      // When data IS stale, React Query revalidates in the background while the
      // existing data stays on screen — `isLoading` (isPending) never flips
      // true once there's cached data, so refetches are silent, never a loader.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>
          <App />
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
