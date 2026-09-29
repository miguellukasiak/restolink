import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { SxProps, Theme } from '@mui/material/styles';
import { radii } from '../../../theme';
import type { QrFormat } from './qrTemplates';

/**
 * Renders a trusted SVG string. Everything interpolated into the templates is
 * escaped or validated before it gets here (see qrArt.escapeXml and the colour
 * checks in QrGeneratorPage), because this is innerHTML.
 */
export function SvgView({
  svg,
  label,
  sx,
}: {
  svg: string;
  label?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
      sx={[
        { lineHeight: 0, '& > svg': { display: 'block', width: '100%', height: '100%' } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}

/** Where each format is shown: the surface it will actually live on. */
const BACKDROPS: Record<QrFormat, string> = {
  // A plain, neutral card table.
  code: 'radial-gradient(120% 90% at 50% 20%, #F7F9F8 0%, #E6ECE9 100%)',
  // A wall meeting a warm wooden table top.
  tent: 'linear-gradient(180deg, #F4EFE8 0%, #EEE6DB 66%, #D8C3A5 66%, #C9B08D 100%)',
  // Looking down at a dark tabletop.
  sticker: 'radial-gradient(110% 90% at 50% 30%, #4A4F57 0%, #2B2F35 100%)',
  // A light wall.
  poster: 'linear-gradient(180deg, #EEF1F3 0%, #E3E7EA 100%)',
};

/**
 * The design, big, on the surface it is made for. The point of the page: the
 * owner judges the finished thing, not a list of settings.
 */
export function QrStage({
  format,
  svg,
  label,
  sizeLabel,
  box,
}: {
  format: QrFormat;
  svg: string;
  label: string;
  sizeLabel: string;
  /** The design canvas, for the item's proportions. */
  box: { width: number; height: number };
}) {
  const shadow =
    format === 'sticker'
      ? 'drop-shadow(0 10px 18px rgba(0,0,0,0.45))'
      : 'drop-shadow(0 18px 30px rgba(22,28,37,0.22)) drop-shadow(0 2px 4px rgba(22,28,37,0.12))';
  // How much of the stage's height the item takes: a poster fills it, a
  // sticker is small in real life and should look it.
  const heightShare: Record<QrFormat, string> = {
    code: '62%',
    tent: '84%',
    sticker: '64%',
    poster: '90%',
  };

  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 420, md: 540 },
        borderRadius: radii.md,
        overflow: 'hidden',
        background: BACKDROPS[format],
        display: 'flex',
        alignItems: format === 'tent' ? 'flex-end' : 'center',
        justifyContent: 'center',
        pb: format === 'tent' ? { xs: 5, md: 6 } : 0,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: heightShare[format],
          maxWidth: '86%',
          aspectRatio: `${box.width} / ${box.height}`,
        }}
      >
        <SvgView
          svg={svg}
          label={label}
          sx={{ width: '100%', height: '100%', filter: shadow }}
        />
        {format === 'tent' && (
          // The acrylic stand the card slots into.
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: '-6%',
              right: '-6%',
              bottom: '-5%',
              height: '9%',
              borderRadius: '6px 6px 3px 3px',
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 100%)',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 8px 16px rgba(60,40,20,0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />
        )}
      </Box>
      <Chip
        size="small"
        label={sizeLabel}
        sx={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          bgcolor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(6px)',
          fontWeight: 600,
        }}
      />
    </Box>
  );
}
