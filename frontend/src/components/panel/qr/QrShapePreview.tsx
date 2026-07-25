import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  CORNER_DOT_RADIUS,
  CORNER_SQUARE_RADIUS,
  DOT_SHAPE_RADIUS,
  type QrCornerDotType,
  type QrCornerSquareType,
  type QrDotType,
} from '../../../constants/qrPresets';

/** Tiny 3x3 grid hinting at how a dot shape will read across the whole code. */
export function DotPatternPreview({ type }: { type: QrDotType }) {
  const radius = DOT_SHAPE_RADIUS[type];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '3px',
        width: 28,
        height: 28,
      }}
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <Box
          key={index}
          sx={{ bgcolor: 'currentColor', borderRadius: radius }}
        />
      ))}
    </Box>
  );
}

/**
 * Preview of one finder-pattern marker: an outer ring (corner square style)
 * with a filled center (corner dot style) — shown together so each picker
 * reflects the *combined* current look, not just the option in isolation.
 */
export function FinderPatternPreview({
  squareType,
  dotType,
}: {
  squareType: QrCornerSquareType;
  dotType: QrCornerDotType;
}) {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        border: '3px solid currentColor',
        borderRadius: CORNER_SQUARE_RADIUS[squareType],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: 10,
          height: 10,
          bgcolor: 'currentColor',
          borderRadius: CORNER_DOT_RADIUS[dotType],
        }}
      />
    </Box>
  );
}

interface ShapeOptionTileProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}

/** Reusable M3-style tonal tile used by every shape/color picker in the editor. */
export function ShapeOptionTile({
  selected,
  onClick,
  label,
  children,
}: ShapeOptionTileProps) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      sx={{
        width: 72,
        borderRadius: 3,
        py: 1,
        gap: 0.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: selected ? 'secondary.main' : 'text.secondary',
        border: '2px solid',
        borderColor: selected ? 'secondary.main' : 'divider',
        bgcolor: selected ? (t) => alpha(t.palette.secondary.main, 0.08) : 'transparent',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': {
          borderColor: 'secondary.main',
          bgcolor: (t) => alpha(t.palette.secondary.main, 0.06),
        },
      }}
    >
      {children}
      <Typography
        variant="caption"
        sx={{ color: 'text.primary', fontWeight: selected ? 700 : 500, lineHeight: 1.1 }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}
