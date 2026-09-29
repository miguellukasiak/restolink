import { useRef } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { radii } from '../../../theme';
import {
  formatLength,
  type Readability,
  type ReadabilityCheck,
  type Verdict,
} from './qrDesign';
import { usePanelT } from '../../../i18n/panel';
import { SvgView } from './QrStage';

/** A titled group of controls in the design panel. */
export function ControlGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Box component="section">
      <Typography variant="subtitle2" component="h3">
        {title}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" component="p">
          {hint}
        </Typography>
      )}
      <Box sx={{ mt: 1.25 }}>{children}</Box>
    </Box>
  );
}

/**
 * A choice shown as what it looks like. The grid sizes every tile to the
 * widest label, so no label ever touches its border.
 */
export function OptionTile({
  selected,
  onClick,
  label,
  disabled = false,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      sx={{
        flexDirection: 'column',
        gap: 0.75,
        px: 1,
        py: 1.25,
        minWidth: 0,
        borderRadius: radii.sm,
        border: '1.5px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: (t) => (selected ? alpha(t.palette.primary.main, 0.08) : 'transparent'),
        color: selected ? 'primary.dark' : 'text.secondary',
        opacity: disabled ? 0.45 : 1,
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': { borderColor: selected ? 'primary.main' : 'text.disabled' },
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
      <Typography
        variant="caption"
        noWrap
        sx={{
          fontWeight: selected ? 700 : 600,
          color: selected ? 'primary.dark' : 'text.primary',
          maxWidth: '100%',
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}

/** OptionTiles in as many equal columns as fit — or exactly `columns`. */
export function OptionGrid({
  columns,
  children,
}: {
  columns?: number;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: columns
          ? `repeat(${columns}, minmax(0, 1fr))`
          : 'repeat(auto-fill, minmax(86px, 1fr))',
        gap: 1,
      }}
    >
      {children}
    </Box>
  );
}

export function ShapeSample({ svg }: { svg: string }) {
  return <SvgView svg={svg} sx={{ width: 26, height: 26 }} />;
}

/** One-tap colours, plus a native picker for anything else. */
export function SwatchRow({
  swatches,
  value,
  onChange,
  label,
}: {
  swatches: { color: string; label: string }[];
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const { t } = usePanelT();
  const inputRef = useRef<HTMLInputElement>(null);
  const known = swatches.some(
    (swatch) => swatch.color.toLowerCase() === value.toLowerCase(),
  );
  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={1}
      sx={{ flexWrap: 'wrap', alignItems: 'center' }}
    >
      {swatches.map((swatch) => {
        const selected = swatch.color.toLowerCase() === value.toLowerCase();
        return (
          <Tooltip key={swatch.label} title={swatch.label} arrow>
            <ButtonBase
              onClick={() => onChange(swatch.color)}
              aria-label={`${label}: ${swatch.label}`}
              aria-pressed={selected}
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                bgcolor: swatch.color,
                color: '#FFFFFF',
                boxShadow: (t) =>
                  selected
                    ? `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${t.palette.primary.main}`
                    : `inset 0 0 0 1px ${alpha('#000', 0.12)}`,
              }}
            >
              {selected && <CheckRoundedIcon sx={{ fontSize: 18 }} />}
            </ButtonBase>
          </Tooltip>
        );
      })}
      <Tooltip title={t('qr.customColour')} arrow>
        <ButtonBase
          onClick={() => inputRef.current?.click()}
          aria-label={`${label}: ${t('qr.customColour')}`}
          aria-pressed={!known}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: known ? '1.5px dashed' : 'none',
            borderColor: 'text.disabled',
            bgcolor: known ? 'transparent' : value,
            color: known ? 'text.secondary' : '#FFFFFF',
            boxShadow: (t) =>
              known
                ? 'none'
                : `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${t.palette.primary.main}`,
          }}
        >
          {known ? (
            <AddRoundedIcon fontSize="small" />
          ) : (
            <CheckRoundedIcon sx={{ fontSize: 18 }} />
          )}
        </ButtonBase>
      </Tooltip>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        aria-label={`${label}: ${t('qr.anyColour')}`}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </Stack>
  );
}

const VERDICT_COLOR: Record<Verdict, 'success' | 'warning' | 'error'> = {
  great: 'success',
  ok: 'success',
  weak: 'warning',
  bad: 'error',
};

function VerdictIcon({ verdict, pending }: { verdict: Verdict; pending?: boolean }) {
  if (pending) return <CircularProgress size={16} thickness={6} />;
  const color = VERDICT_COLOR[verdict];
  if (color === 'success')
    return <CheckCircleRoundedIcon color="success" sx={{ fontSize: 18 }} />;
  if (color === 'warning')
    return <WarningAmberRoundedIcon color="warning" sx={{ fontSize: 18 }} />;
  return <ErrorRoundedIcon color="error" sx={{ fontSize: 18 }} />;
}

/** What the scan test and the checks concluded, in plain words. */
export function ReadabilityPanel({
  readability,
  testing,
}: {
  readability: Readability;
  testing: boolean;
}) {
  const { t, i18n } = usePanelT();
  const tone = VERDICT_COLOR[readability.verdict];
  const locale = i18n.language;
  const sentence = ({ id, detail, values }: ReadabilityCheck) =>
    t(`qr.check.${id}.${detail}`, {
      ...values,
      ratio: values.ratio?.toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      code: values.code === undefined ? undefined : formatLength(values.code, locale),
      distance:
        values.distance === undefined ? undefined : formatLength(values.distance, locale),
      comfortable:
        values.comfortable === undefined
          ? undefined
          : formatLength(values.comfortable, locale),
    });
  return (
    <Box
      aria-live="polite"
      sx={{
        borderRadius: radii.md,
        p: 2,
        bgcolor: (t) => alpha(t.palette[tone].main, 0.07),
        border: '1px solid',
        borderColor: (t) => alpha(t.palette[tone].main, 0.25),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <VerdictIcon verdict={readability.verdict} pending={testing} />
        <Typography variant="subtitle2">
          {testing ? t('qr.checking') : t(`qr.verdict.${readability.verdict}`)}
        </Typography>
      </Stack>
      <Stack spacing={0.75}>
        {readability.checks.map((check) => (
          <Stack
            key={check.id}
            direction="row"
            spacing={1}
            sx={{ alignItems: 'flex-start' }}
          >
            <Box sx={{ pt: '1px' }}>
              <VerdictIcon
                verdict={check.verdict}
                pending={testing && check.id === 'scan'}
              />
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
              <Box component="span" sx={{ fontWeight: 600 }}>
                {t(`qr.check.${check.id}.label`)}:
              </Box>{' '}
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {sentence(check)}
              </Box>
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
