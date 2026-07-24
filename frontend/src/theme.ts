import { createTheme, alpha } from '@mui/material/styles';

/**
 * Material Design 3 inspired theme: generous corner radii, soft layered
 * shadows, tonal surfaces and a confident type scale.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#5B4CDB', light: '#8B7FF0', dark: '#3F32A8' },
    secondary: { main: '#00696D', light: '#4DA9AD', dark: '#004B4E' },
    success: { main: '#2E7D32' },
    error: { main: '#C62828' },
    warning: { main: '#ED6C02' },
    background: { default: '#F6F5FB', paper: '#FFFFFF' },
    text: { primary: '#1C1B22', secondary: '#5E5C6B' },
    divider: alpha('#1C1B22', 0.08),
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        elevation1: { boxShadow: '0 2px 12px rgba(28, 27, 34, 0.06)' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 4px 24px rgba(28, 27, 34, 0.06)',
          border: `1px solid ${alpha('#1C1B22', 0.06)}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          boxShadow: '0 24px 64px rgba(28, 27, 34, 0.18)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 20 },
        contained: {
          boxShadow: '0 4px 14px rgba(91, 76, 219, 0.35)',
          '&:hover': { boxShadow: '0 6px 18px rgba(91, 76, 219, 0.45)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#FFFFFF', 0.85),
          backdropFilter: 'blur(12px)',
          color: '#1C1B22',
          boxShadow: `inset 0 -1px 0 ${alpha('#1C1B22', 0.08)}`,
        },
      },
    },
  },
});
