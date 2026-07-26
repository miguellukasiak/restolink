import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

/**
 * Loading placeholder mirroring the public menu's final layout (logo + search,
 * category pills, dish grid). Shared by the live public page and the
 * appearance-settings device preview so both show the same M3 loading state.
 */
export function PublicMenuSkeleton() {
  return (
    <Stack spacing={3} sx={{ px: 2, pt: 3, maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Skeleton variant="circular" width={56} height={56} />
        <Skeleton variant="rounded" height={48} sx={{ flex: 1, borderRadius: 999 }} />
      </Stack>
      <Stack direction="row" spacing={2}>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} variant="circular" width={56} height={56} />
        ))}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 2,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <Skeleton key={key} variant="rounded" height={180} sx={{ borderRadius: 4 }} />
        ))}
      </Box>
    </Stack>
  );
}
