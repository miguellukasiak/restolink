import type SvgIcon from '@mui/material/SvgIcon';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import OutdoorGrillRoundedIcon from '@mui/icons-material/OutdoorGrillRounded';
import EnergySavingsLeafRoundedIcon from '@mui/icons-material/EnergySavingsLeafRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import WifiRoundedIcon from '@mui/icons-material/WifiRounded';
import PetsRoundedIcon from '@mui/icons-material/PetsRounded';
import ChildCareRoundedIcon from '@mui/icons-material/ChildCareRounded';
import LocalCafeRoundedIcon from '@mui/icons-material/LocalCafeRounded';
import WineBarRoundedIcon from '@mui/icons-material/WineBarRounded';
import type { MenuNoteStyle } from '../../types';

/**
 * The icons a note may carry, by the slug stored in `menu_note.style.icon`.
 * The frontend owns the artwork, like the menu's background patterns: a slug
 * this list no longer has is drawn as the default rather than failing. The
 * panel names each one through `noteDialog.icons.<slug>`.
 */
export const NOTE_ICONS = {
  info: InfoOutlinedIcon,
  star: StarRoundedIcon,
  clock: ScheduleRoundedIcon,
  fire: LocalFireDepartmentRoundedIcon,
  grill: OutdoorGrillRoundedIcon,
  leaf: EnergySavingsLeafRoundedIcon,
  quality: WorkspacePremiumRoundedIcon,
  heart: FavoriteRoundedIcon,
  offer: LocalOfferRoundedIcon,
  celebration: CelebrationRoundedIcon,
  allergy: HealthAndSafetyRoundedIcon,
  wifi: WifiRoundedIcon,
  pets: PetsRoundedIcon,
  kids: ChildCareRoundedIcon,
  coffee: LocalCafeRoundedIcon,
  wine: WineBarRoundedIcon,
} satisfies Record<string, typeof SvgIcon>;

export type NoteIcon = keyof typeof NOTE_ICONS;

export const DEFAULT_NOTE_ICON: NoteIcon = 'info';

/** A stored look with the defaults filled in, the way the server fills them. */
export function noteLook(style: Partial<MenuNoteStyle> | undefined): MenuNoteStyle {
  return {
    icon: style?.icon === undefined ? DEFAULT_NOTE_ICON : style.icon,
    variant: style?.variant ?? 'card',
    align: style?.align ?? 'left',
  };
}

/** The component for a stored slug; null draws no icon. */
export function noteIconComponent(icon: string | null) {
  if (icon === null) return null;
  return NOTE_ICONS[icon as NoteIcon] ?? NOTE_ICONS[DEFAULT_NOTE_ICON];
}
