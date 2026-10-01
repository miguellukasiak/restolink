import type { ChangeEvent, ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ColorizeRoundedIcon from '@mui/icons-material/ColorizeRounded';
import { usePanelT } from '../../i18n/panel';
import { isDarkColor } from '../../utils/colors';

/**
 * The owner panel's colour pickers share one vocabulary, after the one every
 * Paint user knows: a rainbow circle opens any colour, and the colour picked
 * there joins the row as a swatch of its own, beside the ready ones. Before,
 * "any colour" was a dashed "+" at the end of one row, an eyedropper icon
 * that opened a palette on another, and a swatch with an icon on a third.
 */

const HEX = /^#[0-9a-f]{6}$/i;

const isHex = (value: string | null | undefined): value is string =>
  HEX.test(value ?? '');

/** A colour wheel: every hue round the rim, paler towards the middle. */
const RAINBOW =
  'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 62%), ' +
  'conic-gradient(#ff3b30, #ff9500, #ffcc00, #34c759, #00c7be, #007aff, #5856d6, #af52de, #ff2d55, #ff3b30)';

/**
 * The browser's own colour input, laid invisibly over its parent (which must
 * be positioned). The tap lands on the input itself, so the picker opens on
 * every browser — iOS included, which ignores a scripted click on a hidden
 * one — and the browser anchors its popup to the swatch that was tapped.
 */
function NativeColorInput({
  value,
  onChange,
  label,
  duplicate = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** A second way to the same picker: out of the tab order and unannounced. */
  duplicate?: boolean;
}) {
  return (
    <Box
      component="input"
      type="color"
      value={isHex(value) ? value.toLowerCase() : '#000000'}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value.toUpperCase())
      }
      aria-label={duplicate ? undefined : label}
      aria-hidden={duplicate || undefined}
      tabIndex={duplicate ? -1 : undefined}
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        m: 0,
        p: 0,
        border: 0,
        opacity: 0,
        cursor: 'pointer',
      }}
    />
  );
}

/** A visible focus ring on the shape when the hidden input has focus. */
const focusRing = {
  '&:has(input:focus-visible)': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: 2,
  },
} as const;

/** The rainbow circle that opens any colour. First in every row. */
export function CustomColorSwatch({
  value,
  onChange,
  label,
  size = 34,
}: {
  value: string;
  onChange: (value: string) => void;
  /** What the colour is for, e.g. "Primary colour". */
  label: string;
  size?: number;
}) {
  const { t } = usePanelT();
  return (
    <Tooltip title={t('color.pickAny')} arrow>
      <Box
        sx={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: '50%',
          background: RAINBOW,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
          transition: 'transform 0.15s ease',
          '&:hover': { transform: 'scale(1.08)' },
          ...focusRing,
        }}
      >
        {/* The "+" badge says this one adds a colour rather than being one. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -3,
            right: -3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'background.paper',
            color: 'text.primary',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
          }}
        >
          <AddRoundedIcon sx={{ fontSize: 13 }} />
        </Box>
        <NativeColorInput
          value={value}
          onChange={onChange}
          label={t('color.pickAnyFor', { label })}
        />
      </Box>
    </Tooltip>
  );
}

/**
 * The square at the start of a hex field: shows the colour and, tapped,
 * opens the same picker as the rainbow circle. Keyboards use the circle, so
 * a screen reader does not meet the same control twice.
 */
export function ColorSquare({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const { t } = usePanelT();
  return (
    <Tooltip title={t('color.pickAny')} arrow>
      <Box
        sx={{
          position: 'relative',
          width: 24,
          height: 24,
          mr: 1,
          flexShrink: 0,
          borderRadius: '6px',
          bgcolor: isHex(value) ? value : 'transparent',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          '&:hover': {
            transform: 'scale(1.1)',
            boxShadow: '0 0 0 3px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.18)',
          },
          ...focusRing,
        }}
      >
        <NativeColorInput
          value={value}
          onChange={onChange}
          label={t('color.pickAnyFor', { label })}
          duplicate
        />
      </Box>
    </Tooltip>
  );
}

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperConstructor {
  new (): { open: () => Promise<EyeDropperResult> };
}

const eyeDropper = (): EyeDropperConstructor | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;

/**
 * A real eyedropper: takes a colour from anywhere on the screen — the
 * owner's logo, say. Only where the browser has one (Chrome, Edge); nothing
 * is shown elsewhere rather than a button that cannot work.
 */
export function EyeDropperButton({
  onPick,
  label,
}: {
  onPick: (value: string) => void;
  label: string;
}) {
  const { t } = usePanelT();
  const Dropper = eyeDropper();
  if (!Dropper) return null;
  const pick = () => {
    new Dropper()
      .open()
      .then((result) => {
        const hex = result.sRGBHex;
        if (isHex(hex)) onPick(hex.toUpperCase());
      })
      // Escape cancels the dropper; nothing to do.
      .catch(() => undefined);
  };
  return (
    <Tooltip title={t('color.eyedropper')} arrow>
      <IconButton
        size="small"
        onClick={pick}
        aria-label={t('color.eyedropperFor', { label })}
      >
        <ColorizeRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

/** A plain round swatch, as the rows draw their ready colours. */
export function OwnColorSwatch({
  color,
  selected,
  onSelect,
  label,
  size = 34,
  children,
}: {
  color: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  size?: number;
  children?: ReactNode;
}) {
  const { t } = usePanelT();
  return (
    <Tooltip title={t('color.yours', { hex: color })} arrow>
      <Box
        component="button"
        type="button"
        onClick={onSelect}
        aria-label={`${label}: ${t('color.yours', { hex: color })}`}
        aria-pressed={selected}
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          p: 0,
          border: 0,
          cursor: 'pointer',
          borderRadius: '50%',
          bgcolor: color,
          display: 'grid',
          placeItems: 'center',
          // A tick that shows on a pale colour as well as a dark one.
          color: isDarkColor(color) ? '#FFFFFF' : 'rgba(0,0,0,0.78)',
          boxShadow: (theme) =>
            selected
              ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.primary.main}`
              : 'inset 0 0 0 1px rgba(0,0,0,0.14)',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 4,
          },
        }}
      >
        {children}
      </Box>
    </Tooltip>
  );
}
