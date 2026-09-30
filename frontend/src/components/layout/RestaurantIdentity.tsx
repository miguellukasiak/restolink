import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { fontStack, getFontPairing } from '../../constants/menuStyle';
import { getContrastingTextColor, hexToRgb } from '../../utils/colors';

interface RestaurantIdentityProps {
  name: string | undefined;
  logoUrl?: string | null;
  primaryColor?: string | null;
  fontFamily?: string | null;
  loading: boolean;
}

const AVATAR = 34;

/** "Sushi Master" → "SM", "Bistro Pod Lipą" → "BP", "Kasza" → "K". */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

/**
 * The restaurant, in the panel's header, dressed as its own menu is: its
 * logo — or, without one, a monogram in its brand colour — and its name in
 * the heading face of its menu's font pairing.
 *
 * It replaced the name in the panel's UI font with "Zarządzaj swoją
 * restauracją" under it: plain body text beside a display wordmark read as
 * an afterthought, and the tagline told the owner what they already knew.
 * Now the header pairs two brands — ours, and theirs as their guests see it
 * — and changes with "Wygląd menu" (the info query reads the theme).
 */
export function RestaurantIdentity({
  name,
  logoUrl,
  primaryColor,
  fontFamily,
  loading,
}: RestaurantIdentityProps) {
  if (loading || !name) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Skeleton variant="circular" width={AVATAR} height={AVATAR} />
        <Skeleton variant="text" width={140} height={28} />
      </Stack>
    );
  }

  const pairing = getFontPairing(fontFamily);
  const brand = primaryColor && hexToRgb(primaryColor) ? primaryColor : '#0F8256';
  const heading = { fontFamily: fontStack(pairing.heading.family) };

  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
      {logoUrl ? (
        <Box
          component="img"
          src={logoUrl}
          alt=""
          sx={{
            width: AVATAR,
            height: AVATAR,
            flexShrink: 0,
            borderRadius: '50%',
            objectFit: 'cover',
            bgcolor: '#FFFFFF',
            boxShadow: '0 0 0 1px rgba(22, 28, 37, 0.1)',
          }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            ...heading,
            width: AVATAR,
            height: AVATAR,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: brand,
            color: getContrastingTextColor(brand),
            fontWeight: pairing.heading.weight,
            fontSize: 14 * (pairing.headingScale ?? 1),
            letterSpacing: '0.02em',
            lineHeight: 1,
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.18)',
          }}
        >
          {monogram(name)}
        </Box>
      )}
      <Typography
        component="span"
        noWrap
        sx={{
          ...heading,
          fontWeight: pairing.heading.weight,
          fontSize: 19 * (pairing.headingScale ?? 1),
          lineHeight: 1.25,
          letterSpacing: '-0.005em',
          color: 'text.primary',
          minWidth: 0,
        }}
      >
        {name}
      </Typography>
    </Stack>
  );
}
