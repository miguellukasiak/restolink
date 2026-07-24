import type { ReactElement } from 'react';
import BakeryDiningRoundedIcon from '@mui/icons-material/BakeryDiningRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import EggRoundedIcon from '@mui/icons-material/EggRounded';
import SetMealRoundedIcon from '@mui/icons-material/SetMealRounded';
import GrassRoundedIcon from '@mui/icons-material/GrassRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import EcoRoundedIcon from '@mui/icons-material/EnergySavingsLeafRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import SellRoundedIcon from '@mui/icons-material/SellRounded';

const ALLERGEN_ICONS: Record<string, ReactElement> = {
  Gluten: <BakeryDiningRoundedIcon />,
  Laktoza: <WaterDropRoundedIcon />,
  Orzechy: <SpaRoundedIcon />,
  Jaja: <EggRoundedIcon />,
  Soja: <GrassRoundedIcon />,
  Ryby: <SetMealRoundedIcon />,
  Seler: <EcoRoundedIcon />,
  Gorczyca: <WarningAmberRoundedIcon />,
};

const TAG_ICONS: Record<string, ReactElement> = {
  Wegańskie: <SpaRoundedIcon />,
  Wegetariańskie: <EcoRoundedIcon />,
  Bestseller: <StarRoundedIcon />,
  Pikantne: <LocalFireDepartmentRoundedIcon />,
  Nowość: <FiberNewRoundedIcon />,
};

/** Icon for an allergen chip; falls back to a warning triangle. */
export function getAllergenIcon(name: string): ReactElement {
  return ALLERGEN_ICONS[name] ?? <WarningAmberRoundedIcon />;
}

/** Icon for a dietary/marketing tag chip; falls back to a label icon. */
export function getTagIcon(name: string): ReactElement {
  return TAG_ICONS[name] ?? <SellRoundedIcon />;
}
