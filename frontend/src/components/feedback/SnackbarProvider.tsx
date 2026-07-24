import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';

interface SnackbarContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

/**
 * App-wide notifications rendered as a MUI Snackbar + filled Alert.
 * Consume via `useSnackbar()` — never use `window.alert`.
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const show = useCallback((message: string, severity: AlertColor) => {
    setState({ open: true, message, severity });
  }, []);

  const value = useMemo<SnackbarContextValue>(
    () => ({
      showSuccess: (message) => show(message, 'success'),
      showError: (message) => show(message, 'error'),
      showInfo: (message) => show(message, 'info'),
    }),
    [show],
  );

  const handleClose = (_event?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setState((prev) => ({ ...prev, open: false }));
  };

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="filled"
          elevation={6}
          sx={{ minWidth: 320 }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
