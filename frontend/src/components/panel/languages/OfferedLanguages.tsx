import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { MANY_LANGUAGES, getMenuLanguage } from '../../../constants/menuLanguages';
import { radii } from '../../../theme';
import worldMap from './worldCountries.json';
import { formatPeople, reach } from './reach';
import { useLanguageName, usePanelT } from '../../../i18n/panel';

interface OfferedLanguagesProps {
  base: string;
  offered: readonly string[];
  phrasesTotal: number;
  translated: (code: string) => number;
  editing: string | null;
  busy: boolean;
  onEdit: (code: string) => void;
  onRemove: (code: string) => void;
}

/**
 * What guests read where a language is not finished (`offered.fallback.*`).
 * The fallback runs per phrase — English where it exists, then the menu's
 * own language — so an unfinished English cannot be promised as the safety
 * net. A Polish menu keeps its own words ("po polsku"); any other names its
 * language.
 */
function fallbackKey(
  base: string,
  offered: readonly string[],
  code: string,
  englishDone: number,
  phrasesTotal: number,
) {
  const own = base === 'pl' ? 'polish' : 'base';
  if (code === 'en' || !offered.includes('en') || englishDone === 0) return own;
  if (englishDone >= phrasesTotal) return 'english';
  return base === 'pl' ? 'englishOrPolish' : 'englishOrBase';
}

/**
 * The languages guests can pick, each with how far its translation has got
 * and how many people it alone brings — the honest measure of whether it is
 * worth its upkeep.
 */
export function OfferedLanguages({
  base,
  offered,
  phrasesTotal,
  translated,
  editing,
  busy,
  onEdit,
  onRemove,
}: OfferedLanguagesProps) {
  const { t, i18n } = usePanelT();
  const languageName = useLanguageName();
  const all = [base, ...offered];
  const everyone = reach(worldMap.countries, all);
  const missing = offered.reduce(
    (sum, code) => sum + Math.max(phrasesTotal - translated(code), 0),
    0,
  );

  return (
    <Stack spacing={1.5}>
      <Row title={languageName(base)} subtitle={t('offered.baseSubtitle')} />

      {offered.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: radii.md }}>
          {base === 'pl'
            ? t('offered.onlyPolish')
            : t('offered.onlyBase', { base: languageName(base) })}
        </Alert>
      )}

      {offered.map((code) => {
        const meta = getMenuLanguage(code);
        const done = translated(code);
        const share = phrasesTotal > 0 ? done / phrasesTotal : 1;
        const only =
          everyone -
          reach(
            worldMap.countries,
            all.filter((entry) => entry !== code),
          );
        const fallback = t(
          `offered.fallback.${fallbackKey(base, offered, code, translated('en'), phrasesTotal)}`,
          { base: languageName(base) },
        );
        const status =
          share >= 1
            ? t('offered.done')
            : done === 0
              ? t('offered.untranslated', { fallback })
              : t('offered.partial', {
                  percent: `${Math.round(share * 100)}%`,
                  fallback,
                });

        return (
          <Row
            key={code}
            selected={editing === code}
            title={languageName(code)}
            endonym={meta?.endonym}
            code={code}
            subtitle={status}
            aside={t('offered.only', { people: formatPeople(only, i18n.language) })}
            progress={share}
            actions={
              <>
                <Button
                  size="small"
                  variant={share >= 1 ? 'text' : 'contained'}
                  startIcon={<EditNoteRoundedIcon />}
                  onClick={() => onEdit(code)}
                >
                  {share >= 1 ? t('offered.revise') : t('offered.translate')}
                </Button>
                <Tooltip title={t('offered.hideTooltip')} arrow>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('offered.hideAria', { name: languageName(code) })}
                      disabled={busy}
                      onClick={() => onRemove(code)}
                    >
                      <VisibilityOffRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            }
          />
        );
      })}

      {offered.length > 0 && (
        <Box
          sx={{
            borderRadius: radii.md,
            px: 2,
            py: 1.5,
            bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
          }}
        >
          <Typography variant="subtitle2">{t('offered.workTitle')}</Typography>
          <Typography variant="body2" color="textSecondary">
            {t('offered.work', {
              translations: offered.length * 3,
              inLanguages: t('reach.inLanguages', { count: offered.length }),
            })}
            {missing > 0
              ? t('offered.waiting', { phrases: t('count.phrases', { count: missing }) })
              : t('offered.allDone')}
          </Typography>
        </Box>
      )}

      {offered.length >= MANY_LANGUAGES && (
        <Alert severity="warning" sx={{ borderRadius: radii.md }}>
          {t('offered.many', {
            languages: t('count.languages', { count: offered.length }),
          })}
        </Alert>
      )}
    </Stack>
  );
}

function Row({
  title,
  endonym,
  code,
  subtitle,
  aside,
  progress,
  actions,
  selected = false,
}: {
  title: string;
  endonym?: string;
  code?: string;
  subtitle: string;
  aside?: string;
  progress?: number;
  actions?: React.ReactNode;
  selected?: boolean;
}) {
  return (
    <Box
      sx={{
        borderRadius: radii.md,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: (t) =>
          selected ? alpha(t.palette.primary.main, 0.05) : 'background.paper',
        px: 2,
        py: 1.5,
      }}
    >
      {/* Side by side where there is room; on a phone the buttons go under
          the text, which would otherwise wrap into a narrow column. */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1, sm: 1.5 }}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
          >
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, textTransform: 'capitalize' }}
            >
              {title}
            </Typography>
            {endonym && endonym.toLowerCase() !== title.toLowerCase() && (
              <Typography variant="body2" color="textSecondary" lang={code} dir="auto">
                {endonym}
              </Typography>
            )}
            {aside && (
              <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                {aside}
              </Typography>
            )}
          </Stack>
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        </Box>
        {actions && (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', flexShrink: 0, justifyContent: 'flex-end' }}
          >
            {actions}
          </Stack>
        )}
      </Stack>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.min(progress, 1) * 100}
          color={progress >= 1 ? 'success' : 'primary'}
          sx={{ mt: 1.25, height: 6, borderRadius: radii.pill }}
        />
      )}
    </Box>
  );
}
