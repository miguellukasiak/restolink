import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/** Shown in a panel page's place while its code is still on the way. */
export function PageLoader() {
  return (
    <Box
      role="progressbar"
      aria-label="Wczytywanie"
      sx={{ display: 'flex', justifyContent: 'center', py: 12 }}
    >
      <CircularProgress size={32} />
    </Box>
  );
}
