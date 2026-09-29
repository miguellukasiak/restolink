import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import TableRestaurantRoundedIcon from '@mui/icons-material/TableRestaurantRounded';
import PanoramaFishEyeRoundedIcon from '@mui/icons-material/PanoramaFishEyeRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import LocalPrintshopRoundedIcon from '@mui/icons-material/LocalPrintshopRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PolylineRoundedIcon from '@mui/icons-material/PolylineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { FONT_OPTIONS } from '../../constants/menu';
import { radii } from '../../theme';
import { qrMenuPayload, shortMenuUrl } from '../../utils/menuLink';
import { plCount } from '../../utils/plural';
import {
  buildMatrix,
  dotSample,
  errorCorrectionFor,
  eyeSample,
  qrArt,
  type CenterMark,
  type QrLook,
} from '../../components/panel/qr/qrArt';
import {
  CUSTOM_CODE_CM,
  FORMATS,
  designBox,
  planSheet,
  resolveSize,
  sheetDocument,
  svgDocument,
  templateBody,
  type QrBrand,
  type QrFormat,
  type QrWording,
} from '../../components/panel/qr/qrTemplates';
import {
  CENTER_SCALE,
  CTA_MAX_LENGTH,
  CTA_PRESETS,
  DEFAULT_SIZES,
  DOT_OPTIONS,
  EYE_OPTIONS,
  SAFE_SWATCHES,
  assessReadability,
  defaultDesign,
  presetsFor,
  readableOnWhite,
  weakestContrast,
  type CenterChoice,
  type CenterSize,
  type QrDesign,
} from '../../components/panel/qr/qrDesign';
import {
  decodesTo,
  downloadPng,
  downloadSvg,
  embeddedFontCss,
  printSheet,
  toDataUri,
} from '../../components/panel/qr/qrExport';
import { QrStage, SvgView } from '../../components/panel/qr/QrStage';
import {
  ControlGroup,
  OptionTile,
  ReadabilityPanel,
  ShapeSample,
  SwatchRow,
  OptionGrid,
} from '../../components/panel/qr/QrControls';

const HEX = /^#[0-9a-fA-F]{6}$/;
const safeHex = (value: unknown, fallback: string) =>
  typeof value === 'string' && HEX.test(value) ? value.toUpperCase() : fallback;

const FORMAT_ORDER: { value: QrFormat; icon: ReactNode; slug: string }[] = [
  { value: 'tent', icon: <TableRestaurantRoundedIcon />, slug: 'stojak' },
  { value: 'sticker', icon: <PanoramaFishEyeRoundedIcon />, slug: 'naklejka' },
  { value: 'poster', icon: <ArticleRoundedIcon />, slug: 'plakat' },
  { value: 'code', icon: <QrCode2RoundedIcon />, slug: 'kod' },
];

const CENTER_SIZE_LABEL: Record<CenterSize, string> = {
  S: 'Mały',
  M: 'Średni',
  L: 'Duży',
};

/** Where the last design is remembered, per restaurant and per browser. */
const storageKey = (restaurantId: string) => `restolink.qr-design.${restaurantId}`;

/**
 * A remembered design, if it still has the shape this page expects. Colours
 * are re-validated because they end up inside SVG markup.
 */
function loadDesign(restaurantId: string): QrDesign | null {
  try {
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as QrDesign;
    const { look, wording } = saved;
    const valid =
      DOT_OPTIONS.some((option) => option.value === look.dots) &&
      EYE_OPTIONS.some((option) => option.value === look.eyes) &&
      HEX.test(look.color) &&
      HEX.test(look.eyeColor) &&
      (look.gradientTo === null || HEX.test(look.gradientTo)) &&
      ['logo', 'icon', 'upload', 'none'].includes(saved.center) &&
      ['S', 'M', 'L'].includes(saved.centerSize) &&
      saved.format in FORMATS &&
      typeof wording.cta === 'string' &&
      typeof wording.showName === 'boolean' &&
      ['brand', 'light'].includes(wording.surface);
    if (!valid) return null;
    // Designs saved before print sizes existed have none: fill in defaults,
    // and drop any size a format no longer offers.
    const sizes = { ...DEFAULT_SIZES };
    for (const format of Object.keys(FORMATS) as QrFormat[]) {
      const id = saved.sizes?.[format];
      const offered =
        FORMATS[format].sizes.some((size) => size.id === id) ||
        (format === 'code' && id === 'custom');
      if (typeof id === 'string' && offered) sizes[format] = id;
    }
    const customCm =
      typeof saved.customCm === 'number' && Number.isFinite(saved.customCm)
        ? Math.min(CUSTOM_CODE_CM.max, Math.max(CUSTOM_CODE_CM.min, saved.customCm))
        : 6;
    return {
      ...saved,
      sizes,
      customCm,
      wording: { ...wording, cta: wording.cta.slice(0, CTA_MAX_LENGTH) },
    };
  } catch {
    return null;
  }
}

function saveDesign(restaurantId: string, design: QrDesign) {
  try {
    localStorage.setItem(storageKey(restaurantId), JSON.stringify(design));
  } catch {
    // Not remembering is fine; the page works the same.
  }
}

/** An uploaded image, scaled down so it does not bloat every export. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Nie udało się wczytać obrazu.'));
      image.onload = () => {
        // An SVG without width/height reports 0×0; give it a square to fill.
        const width = image.width || 512;
        const height = image.height || 512;
        const scale = Math.min(1, 512 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * "Kody QR" — a studio for the printed QR code, not a form of settings.
 *
 * The page starts from finished designs in the restaurant's own colour and
 * shows the chosen one on the thing it will be printed on — a table card, a
 * round sticker, a poster — at its real proportions. Every change is decoded
 * from the rendered pixels, so a design that stopped scanning says so before
 * it is printed. Output is print-ready: an A4 sheet through the browser's
 * print dialog (vector PDF), a 300 dpi PNG, or an SVG.
 *
 * The code itself is a short, compact link (see utils/menuLink.ts) and never
 * changes: editing the menu never means reprinting.
 */
export function QrGeneratorPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();
  const publicMenu = usePublicMenu(restaurantId);
  const instanceId = `qr${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const uploadRef = useRef<HTMLInputElement>(null);
  const origin = window.location.origin;

  const theme = publicMenu.data?.restaurant.theme;
  const brand = useMemo<QrBrand | null>(() => {
    if (!publicMenu.data) {
      // Without the saved theme the studio still works, in RestoLink's colours.
      return publicMenu.isError
        ? { name: '', primary: '#0F8256', background: '#FFFFFF', fontFamily: 'Roboto' }
        : null;
    }
    const { restaurant } = publicMenu.data;
    return {
      name: restaurant.name,
      primary: safeHex(restaurant.theme.primary_color, '#0F8256'),
      background: safeHex(restaurant.theme.background_color, '#FFFFFF'),
      fontFamily: FONT_OPTIONS.some((font) => font.value === restaurant.theme.font_family)
        ? restaurant.theme.font_family
        : 'Roboto',
    };
  }, [publicMenu.data, publicMenu.isError]);

  // The logo from "Wygląd menu", inlined: an image inside an exported SVG or
  // a canvas has to be a data URI, never a cross-origin URL.
  const logoUrl = theme?.logo_url ?? null;
  const logo = useQuery({
    queryKey: ['qr-logo', logoUrl],
    queryFn: () => toDataUri(logoUrl as string),
    enabled: Boolean(logoUrl),
    staleTime: Infinity,
    retry: 1,
  });

  const [design, setDesign] = useState<QrDesign | null>(null);
  const [upload, setUpload] = useState<string | null>(null);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [busy, setBusy] = useState<'print' | 'png' | 'svg' | null>(null);

  useEffect(() => {
    if (brand && !design) {
      setDesign(
        loadDesign(restaurantId) ?? defaultDesign(brand.primary, Boolean(logoUrl)),
      );
    }
  }, [brand, design, logoUrl, restaurantId]);

  useEffect(() => {
    if (design) saveDesign(restaurantId, design);
  }, [design, restaurantId]);

  const centerMark = useMemo<CenterMark>(() => {
    if (!design) return { kind: 'none' };
    if (design.center === 'logo' && logo.data) return { kind: 'image', href: logo.data };
    if (design.center === 'upload' && upload) return { kind: 'image', href: upload };
    if (design.center === 'none') return { kind: 'none' };
    // A logo still loading, or an upload not chosen yet: the icon holds the
    // place, so the code does not jump between sizes.
    return { kind: 'icon' };
  }, [design, logo.data, upload]);

  const level = errorCorrectionFor(centerMark);
  const payload = useMemo(
    () => qrMenuPayload(origin, restaurantId),
    [origin, restaurantId],
  );
  const matrix = useMemo(() => buildMatrix(payload.segments, level), [payload, level]);
  const plainModules = useMemo(
    () =>
      buildMatrix([{ data: `${origin}/menu/${restaurantId}`, mode: 'Byte' }], level).size,
    [origin, restaurantId, level],
  );
  const centerScale = CENTER_SCALE[design?.centerSize ?? 'M'];

  const presets = useMemo(() => (brand ? presetsFor(brand.primary) : []), [brand]);
  const presetThumbs = useMemo(
    () =>
      presets.map((preset) => {
        const art = qrArt({
          matrix,
          look: preset.look,
          center: centerMark,
          centerScale,
          quietZone: 2,
          background: '#FFFFFF',
          id: `${instanceId}-${preset.id}`,
        });
        return svgDocument(art.extent, art.extent, art.markup, { size: 'fluid' });
      }),
    [presets, matrix, centerMark, centerScale, instanceId],
  );

  const format = design?.format ?? 'tent';
  const spec = FORMATS[format];
  const size = resolveSize(
    format,
    design?.sizes[format] ?? spec.defaultSize,
    design?.customCm ?? 6,
  );
  const box = designBox(format, size);
  const body = useMemo(() => {
    if (!design || !brand) return '';
    const art = qrArt({
      matrix,
      look: design.look,
      center: centerMark,
      centerScale,
      quietZone: design.format === 'code' ? 4 : 0,
      background: design.format === 'code' ? '#FFFFFF' : null,
      id: instanceId,
    });
    return templateBody(
      design.format,
      art,
      brand,
      design.wording,
      instanceId,
      box.height,
    );
  }, [design, brand, matrix, centerMark, centerScale, instanceId, box.height]);

  // The scan test: decode the design from its own pixels, as a phone would.
  const [scan, setScan] = useState<{ body: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!body) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      // Sized so the code itself spans ~330px, a phone camera's typical view.
      const px = 330 / spec.codeWidth;
      decodesTo(
        svgDocument(box.width, box.height, body),
        box.width * px,
        box.height * px,
        payload.text,
      )
        .then((ok) => !cancelled && setScan({ body, ok }))
        .catch(() => !cancelled && setScan({ body, ok: false }));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [body, spec, box.width, box.height, payload.text]);
  const testing = scan?.body !== body;

  if (!design || !brand) {
    return (
      <Box sx={{ maxWidth: 1320, mx: 'auto', pt: 4 }}>
        <Skeleton variant="text" width={220} height={48} />
        <Skeleton variant="rounded" height={560} sx={{ mt: 3, borderRadius: radii.lg }} />
      </Box>
    );
  }

  const readability = assessReadability({
    look: design.look,
    format,
    size,
    modules: matrix.size,
    plainModules,
    decoded: testing ? null : (scan?.ok ?? null),
  });

  const update = (patch: Partial<QrDesign>) =>
    setDesign((current) => (current ? { ...current, ...patch } : current));
  const updateLook = (patch: Partial<QrLook>) =>
    setDesign((current) =>
      current
        ? { ...current, look: { ...current.look, ...patch }, presetId: null }
        : current,
    );
  const updateWording = (patch: Partial<QrWording>) =>
    setDesign((current) =>
      current ? { ...current, wording: { ...current.wording, ...patch } } : current,
    );

  const brandSwatch = { color: readableOnWhite(brand.primary), label: 'Kolor marki' };
  const swatches = [
    brandSwatch,
    ...SAFE_SWATCHES.filter((swatch) => swatch.color !== brandSwatch.color),
  ];
  const tooLight = weakestContrast(design.look) < 4.5;
  const plan = planSheet(format, size);
  const sheetLabel =
    format === 'poster'
      ? `Plakat ${size.id} drukuje się na całej stronie ${plan.page}${
          plan.page === 'A3' ? ' — wydrukuj na A3 albo zanieś plik do drukarni' : ''
        }`
      : `${plCount(plan.positions.length, ...spec.unit)} na arkuszu A4`;
  const sizeSlug = slug(
    format === 'code' || format === 'sticker' ? `${size.id}cm` : size.id,
  );
  const fileBase = `${slug(brand.name) || 'menu'}-${FORMAT_ORDER.find((f) => f.value === format)?.slug}-${sizeSlug}-qr`;
  const printed = { width: size.width, height: size.height };
  const setSize = (id: string) =>
    setDesign((current) =>
      current
        ? { ...current, sizes: { ...current.sizes, [current.format]: id } }
        : current,
    );
  const link = shortMenuUrl(origin, restaurantId);

  const exportAs = async (kind: 'print' | 'png' | 'svg') => {
    setBusy(kind);
    try {
      const fontCss =
        format === 'code' ? '' : await embeddedFontCss(['Montserrat', brand.fontFamily]);
      if (kind === 'print') {
        await printSheet(sheetDocument(format, body, size, plan, fontCss), plan);
      } else if (kind === 'png') {
        await downloadPng(
          svgDocument(box.width, box.height, body, { fontCss, print: printed }),
          size.width,
          size.height,
          fileBase,
        );
        showSuccess('Pobrano PNG w jakości do druku (300 dpi).');
      } else {
        downloadSvg(
          svgDocument(box.width, box.height, body, { fontCss, print: printed }),
          fileBase,
        );
        showSuccess('Pobrano SVG — plik wektorowy dla drukarni.');
      }
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Nie udało się przygotować pliku.',
      );
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      showSuccess('Link do menu skopiowany.');
    } catch {
      showError('Nie udało się skopiować linku.');
    }
  };

  const centerOptions: {
    value: CenterChoice;
    label: string;
    icon: ReactNode;
    disabled?: boolean;
    hint?: string;
  }[] = [
    {
      value: 'logo',
      label: 'Logo',
      icon: logo.data ? (
        <Box
          component="img"
          src={logo.data}
          alt=""
          sx={{ width: 26, height: 26, objectFit: 'contain' }}
        />
      ) : (
        <StorefrontRoundedIcon />
      ),
      disabled: !logoUrl || logo.isError,
      hint: !logoUrl
        ? 'Dodaj logo w zakładce „Wygląd menu”'
        : logo.isError
          ? 'Nie udało się wczytać logo — wgraj plik'
          : undefined,
    },
    { value: 'icon', label: 'Sztućce', icon: <RestaurantMenuRoundedIcon /> },
    { value: 'upload', label: 'Obraz', icon: <UploadRoundedIcon /> },
    { value: 'none', label: 'Bez', icon: <BlockRoundedIcon /> },
  ];

  return (
    <Box sx={{ maxWidth: 1320, mx: 'auto', pt: 4 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Kody QR
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Wybierz projekt w kolorach swojej restauracji, zobacz go na stoliku i wydrukuj.
          Każdy kod sprawdzamy, zanim trafi do druku.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 400px' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* ---------------- The result ---------------- */}
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <Paper elevation={1} sx={{ borderRadius: radii.lg, p: 1.5 }}>
            <Box
              role="tablist"
              aria-label="Na czym wydrukujesz kod"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 1,
                mb: 1.5,
              }}
            >
              {FORMAT_ORDER.map((option) => {
                const selected = option.value === format;
                return (
                  <ButtonBase
                    key={option.value}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => update({ format: option.value })}
                    sx={{
                      justifyContent: 'flex-start',
                      gap: 1.25,
                      px: 1.5,
                      py: 1.25,
                      borderRadius: radii.sm,
                      textAlign: 'left',
                      bgcolor: (t) =>
                        selected ? alpha(t.palette.primary.main, 0.1) : 'transparent',
                      color: selected ? 'primary.dark' : 'text.secondary',
                      '&:hover': {
                        bgcolor: (t) =>
                          alpha(t.palette.primary.main, selected ? 0.14 : 0.05),
                      },
                    }}
                  >
                    {option.icon}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        noWrap
                        sx={{ color: selected ? 'primary.dark' : 'text.primary' }}
                      >
                        {FORMATS[option.value].label}
                      </Typography>
                      <Typography variant="caption" noWrap component="p">
                        {
                          resolveSize(
                            option.value,
                            design.sizes[option.value],
                            design.customCm,
                          ).label
                        }
                      </Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
            </Box>
            <Stack
              direction="row"
              useFlexGap
              spacing={0.75}
              sx={{ flexWrap: 'wrap', alignItems: 'center', px: 0.5, mb: 1.5 }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}
              >
                Rozmiar
              </Typography>
              {spec.sizes.map((option) => {
                const selected = design.sizes[format] === option.id;
                return (
                  <Chip
                    key={option.id}
                    label={option.short}
                    clickable
                    variant={selected ? 'filled' : 'outlined'}
                    color={selected ? 'primary' : 'default'}
                    onClick={() => setSize(option.id)}
                    aria-pressed={selected}
                  />
                );
              })}
              {format === 'code' && (
                <Chip
                  label="Własny"
                  clickable
                  variant={design.sizes.code === 'custom' ? 'filled' : 'outlined'}
                  color={design.sizes.code === 'custom' ? 'primary' : 'default'}
                  onClick={() => setSize('custom')}
                  aria-pressed={design.sizes.code === 'custom'}
                />
              )}
              {format === 'code' && design.sizes.code === 'custom' && (
                <TextField
                  size="small"
                  type="number"
                  value={design.customCm}
                  onChange={(event) => {
                    const value = parseFloat(event.target.value.replace(',', '.'));
                    if (Number.isFinite(value)) update({ customCm: value });
                  }}
                  onBlur={() =>
                    update({
                      customCm: Math.min(
                        CUSTOM_CODE_CM.max,
                        Math.max(CUSTOM_CODE_CM.min, design.customCm),
                      ),
                    })
                  }
                  sx={{ width: 112 }}
                  slotProps={{
                    htmlInput: {
                      min: CUSTOM_CODE_CM.min,
                      max: CUSTOM_CODE_CM.max,
                      step: 0.5,
                      'aria-label': 'Własny rozmiar kodu w centymetrach',
                    },
                    input: {
                      endAdornment: <InputAdornment position="end">cm</InputAdornment>,
                    },
                  }}
                />
              )}
              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {sheetLabel}
              </Typography>
            </Stack>
            <QrStage
              format={format}
              svg={svgDocument(box.width, box.height, body, { size: 'fluid' })}
              label={`Podgląd: ${spec.label.toLowerCase()} ${size.label} z kodem QR prowadzącym do menu`}
              sizeLabel={size.label}
              box={box}
            />
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2.5,
              alignItems: 'start',
            }}
          >
            <ReadabilityPanel readability={readability} testing={testing} />

            <Paper elevation={1} sx={{ borderRadius: radii.md, p: 2 }}>
              <Typography variant="subtitle2" component="h2">
                Pobierz i wydrukuj
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mb: 1.5 }}
              >
                {sheetLabel}. W oknie drukowania wybierz „Zapisz jako PDF”, by dostać plik
                dla drukarni.
              </Typography>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={() => void exportAs('print')}
                disabled={busy !== null}
                startIcon={
                  busy === 'print' ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <LocalPrintshopRoundedIcon />
                  )
                }
              >
                Drukuj / PDF
              </Button>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => void exportAs('png')}
                  disabled={busy !== null}
                  startIcon={
                    busy === 'png' ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <ImageRoundedIcon />
                    )
                  }
                >
                  PNG
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => void exportAs('svg')}
                  disabled={busy !== null}
                  startIcon={
                    busy === 'svg' ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <PolylineRoundedIcon />
                    )
                  }
                >
                  SVG
                </Button>
              </Stack>
            </Paper>
          </Box>

          <Paper elevation={1} sx={{ borderRadius: radii.md, p: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <TextField
                label="Link do menu"
                value={link}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Kopiuj link" arrow>
                          <IconButton
                            edge="end"
                            aria-label="Kopiuj link do menu"
                            onClick={() => void copyLink()}
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                href={link}
                target="_blank"
                rel="noopener"
                endIcon={<OpenInNewRoundedIcon />}
                sx={{ flexShrink: 0 }}
              >
                Otwórz menu
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'flex-start' }}>
              <CheckCircleRoundedIcon color="primary" sx={{ fontSize: 18, mt: '1px' }} />
              <Typography variant="body2" color="text.secondary">
                Ten kod się nie zmienia. Edytujesz dania, ceny i zdjęcia — goście od razu
                widzą nowe menu, bez ponownego drukowania.
              </Typography>
            </Stack>
          </Paper>
        </Stack>

        {/* ---------------- The design ---------------- */}
        <Paper elevation={1} sx={{ borderRadius: radii.lg, p: 2.5 }}>
          <Stack spacing={3}>
            <ControlGroup
              title="Gotowe projekty"
              hint={
                brandSwatch.color === brand.primary
                  ? 'W kolorach Twojej restauracji.'
                  : 'W kolorach Twojej restauracji — kolor marki lekko przyciemniony, by kod pewnie się skanował.'
              }
            >
              <Box
                sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25 }}
              >
                {presets.map((preset, index) => {
                  const selected = design.presetId === preset.id;
                  return (
                    <ButtonBase
                      key={preset.id}
                      onClick={() => update({ look: preset.look, presetId: preset.id })}
                      aria-pressed={selected}
                      sx={{
                        flexDirection: 'column',
                        gap: 0.75,
                        p: 1,
                        borderRadius: radii.md,
                        border: '1.5px solid',
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: (t) =>
                          selected ? alpha(t.palette.primary.main, 0.08) : 'transparent',
                        '&:hover': {
                          borderColor: selected ? 'primary.main' : 'text.disabled',
                        },
                      }}
                    >
                      <SvgView
                        svg={presetThumbs[index] ?? ''}
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: radii.xs,
                          overflow: 'hidden',
                        }}
                      />
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          fontWeight: selected ? 700 : 600,
                          color: selected ? 'primary.dark' : 'text.primary',
                        }}
                      >
                        {preset.name}
                      </Typography>
                    </ButtonBase>
                  );
                })}
              </Box>
            </ControlGroup>

            <ControlGroup
              title="Środek kodu"
              hint="Z logo kod ma mocniejszą korekcję błędów — dalej czyta się bez problemu."
            >
              <OptionGrid columns={4}>
                {centerOptions.map((option) => {
                  const tile = (
                    <OptionTile
                      key={option.value}
                      label={option.label}
                      selected={design.center === option.value}
                      disabled={option.disabled}
                      onClick={() => {
                        update({ center: option.value });
                        if (option.value === 'upload' && !upload)
                          uploadRef.current?.click();
                      }}
                    >
                      {option.icon}
                    </OptionTile>
                  );
                  return option.hint ? (
                    <Tooltip key={option.value} title={option.hint} arrow>
                      <span style={{ display: 'grid' }}>{tile}</span>
                    </Tooltip>
                  ) : (
                    tile
                  );
                })}
              </OptionGrid>
              <input
                ref={uploadRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  readImage(file)
                    .then((dataUri) => {
                      setUpload(dataUri);
                      update({ center: 'upload' });
                    })
                    .catch(() => showError('Nie udało się wczytać obrazu.'));
                }}
              />
              {design.center === 'upload' && upload && (
                <Button
                  size="small"
                  onClick={() => uploadRef.current?.click()}
                  sx={{ mt: 1 }}
                >
                  Zmień obraz
                </Button>
              )}
              {design.center !== 'none' && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={design.centerSize}
                  onChange={(_event, value: CenterSize | null) =>
                    value && update({ centerSize: value })
                  }
                  aria-label="Wielkość środka"
                  sx={{ mt: 1.25, display: 'flex' }}
                >
                  {(['S', 'M', 'L'] as const).map((size) => (
                    <ToggleButton key={size} value={size} sx={{ flex: 1, py: 0.5 }}>
                      {CENTER_SIZE_LABEL[size]}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
            </ControlGroup>

            {format !== 'code' && (
              <ControlGroup title="Napis">
                <Stack
                  direction="row"
                  useFlexGap
                  spacing={0.75}
                  sx={{ flexWrap: 'wrap', mb: 1.25 }}
                >
                  {CTA_PRESETS.map((cta) => (
                    <Chip
                      key={cta}
                      label={cta}
                      size="small"
                      clickable
                      variant={design.wording.cta === cta ? 'filled' : 'outlined'}
                      color={design.wording.cta === cta ? 'primary' : 'default'}
                      onClick={() => updateWording({ cta })}
                    />
                  ))}
                </Stack>
                <TextField
                  label="Własny napis"
                  size="small"
                  fullWidth
                  value={design.wording.cta}
                  onChange={(event) =>
                    updateWording({ cta: event.target.value.slice(0, CTA_MAX_LENGTH) })
                  }
                  helperText={`${design.wording.cta.length}/${CTA_MAX_LENGTH}`}
                  slotProps={{ formHelperText: { sx: { textAlign: 'right', mr: 0 } } }}
                />
                <Stack
                  direction="row"
                  sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}
                >
                  <Typography variant="body2">Nazwa restauracji</Typography>
                  <Switch
                    checked={design.wording.showName}
                    onChange={(event) =>
                      updateWording({ showName: event.target.checked })
                    }
                    slotProps={{ input: { 'aria-label': 'Pokaż nazwę restauracji' } }}
                  />
                </Stack>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={design.wording.surface}
                  onChange={(_event, value: QrWording['surface'] | null) =>
                    value && updateWording({ surface: value })
                  }
                  aria-label="Tło"
                  sx={{ display: 'flex', mt: 0.5 }}
                >
                  <ToggleButton value="brand" sx={{ flex: 1, gap: 1 }}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: brand.primary,
                      }}
                    />
                    Kolor marki
                  </ToggleButton>
                  <ToggleButton value="light" sx={{ flex: 1, gap: 1 }}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: brand.background,
                        boxShadow: `inset 0 0 0 1px ${alpha('#000', 0.2)}`,
                      }}
                    />
                    Jasne tło
                  </ToggleButton>
                </ToggleButtonGroup>
              </ControlGroup>
            )}

            <Divider />

            <Box>
              <ButtonBase
                onClick={() => setTuneOpen((open) => !open)}
                aria-expanded={tuneOpen}
                sx={{
                  width: '100%',
                  justifyContent: 'space-between',
                  borderRadius: radii.sm,
                  py: 0.5,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TuneRoundedIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2">Dopasuj kształty i kolory</Typography>
                </Stack>
                <ExpandMoreRoundedIcon
                  sx={{
                    transform: tuneOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </ButtonBase>
              <Collapse in={tuneOpen} unmountOnExit>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <ControlGroup title="Kropki">
                    <OptionGrid>
                      {DOT_OPTIONS.map((option) => (
                        <OptionTile
                          key={option.value}
                          label={option.label}
                          selected={design.look.dots === option.value}
                          onClick={() => updateLook({ dots: option.value })}
                        >
                          <ShapeSample svg={dotSample(option.value)} />
                        </OptionTile>
                      ))}
                    </OptionGrid>
                  </ControlGroup>
                  <ControlGroup title="Narożniki">
                    <OptionGrid>
                      {EYE_OPTIONS.map((option) => (
                        <OptionTile
                          key={option.value}
                          label={option.label}
                          selected={design.look.eyes === option.value}
                          onClick={() => updateLook({ eyes: option.value })}
                        >
                          <ShapeSample svg={eyeSample(option.value)} />
                        </OptionTile>
                      ))}
                    </OptionGrid>
                  </ControlGroup>
                  <ControlGroup title="Kolor kodu">
                    <SwatchRow
                      swatches={swatches}
                      value={design.look.color}
                      onChange={(color) => updateLook({ color })}
                      label="Kolor kodu"
                    />
                  </ControlGroup>
                  <ControlGroup title="Kolor narożników">
                    <SwatchRow
                      swatches={swatches}
                      value={design.look.eyeColor}
                      onChange={(eyeColor) => updateLook({ eyeColor })}
                      label="Kolor narożników"
                    />
                  </ControlGroup>
                  <Box>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography variant="subtitle2" component="h3">
                        Przejście koloru
                      </Typography>
                      <Switch
                        checked={design.look.gradientTo !== null}
                        onChange={(event) =>
                          updateLook({
                            gradientTo: event.target.checked
                              ? readableOnWhite(brand.primary, 7)
                              : null,
                          })
                        }
                        slotProps={{ input: { 'aria-label': 'Przejście koloru' } }}
                      />
                    </Stack>
                    {design.look.gradientTo !== null && (
                      <SwatchRow
                        swatches={swatches}
                        value={design.look.gradientTo}
                        onChange={(gradientTo) => updateLook({ gradientTo })}
                        label="Drugi kolor przejścia"
                      />
                    )}
                  </Box>
                </Stack>
              </Collapse>
              {tooLight && (
                <Alert
                  severity="warning"
                  sx={{ mt: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() =>
                        updateLook({
                          color: readableOnWhite(design.look.color),
                          eyeColor: readableOnWhite(design.look.eyeColor),
                          gradientTo:
                            design.look.gradientTo &&
                            readableOnWhite(design.look.gradientTo),
                        })
                      }
                    >
                      Przyciemnij
                    </Button>
                  }
                >
                  Kolor jest za jasny, by kod czytał się pewnie.
                </Alert>
              )}
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
