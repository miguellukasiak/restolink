import type { ReactElement } from 'react';
import Chip from '@mui/material/Chip';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import type { RestaurantStatus } from '../../types';

const STATUS_CONFIG: Record<
  RestaurantStatus,
  { label: string; color: 'success' | 'error' | 'warning'; icon: ReactElement }
> = {
  ACTIVE: { label: 'Aktywna', color: 'success', icon: <CheckCircleRoundedIcon /> },
  BLOCKED: { label: 'Zablokowana', color: 'error', icon: <BlockRoundedIcon /> },
  PENDING: { label: 'Oczekująca', color: 'warning', icon: <HourglassTopRoundedIcon /> },
};

/** Colored status chip: ACTIVE = green, BLOCKED = red, PENDING = orange. */
export function StatusChip({ status }: { status: RestaurantStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Chip
      size="small"
      label={config.label}
      color={config.color}
      icon={config.icon}
      variant="outlined"
      sx={{ fontWeight: 600 }}
    />
  );
}
