import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useSnackbar } from '../../feedback/SnackbarProvider';
import {
  useAutoTranslate,
  useDictionary,
  useSaveDictionary,
} from '../../../hooks/useDictionary';
import { getApiErrorMessage } from '../../../services/api';
import { getMenuLanguage } from '../../../constants/menuLanguages';
import { radii } from '../../../theme';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The server drafts at most this many phrases per request. */
const DRAFT_BATCH = 100;

interface TranslationEditorProps {
  restaurantId: string;
  language: string;
  /** Tells the page whether leaving this language would lose edits. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * One language's translations, phrase by phrase.
 *
 * Machine translation is only ever a draft here: the free translator once
 * rendered "Smażony ser" as "Gekochter Käse" — *boiled* cheese. DeepL is
 * markedly better, but its proposals land in the fields unsaved, and nothing
 * reaches a guest until the owner presses save.
 */
export function TranslationEditor({
  restaurantId,
  language,
  onDirtyChange,
}: TranslationEditorProps) {
  const { showSuccess, showError } = useSnackbar();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [onlyMissing, setOnlyMissing] = useState(false);

  const dictionary = useDictionary(restaurantId, language);
  const save = useSaveDictionary(restaurantId, language);
  const auto = useAutoTranslate(restaurantId, language);

  const meta = getMenuLanguage(language);
  const code = language.toUpperCase();

  // Reset the working copy whenever the server hands us a new one — on load,
  // on a language switch, and after a save. Without this, edits made for German
  // would bleed into the French screen.
  useEffect(() => {
    if (!dictionary.data) return;
    setDrafts(
      Object.fromEntries(
        dictionary.data.entries.map((entry) => [
          entry.original_text,
          entry.translated_text,
        ]),
      ),
    );
  }, [dictionary.data]);

  const entries = useMemo(() => dictionary.data?.entries ?? [], [dictionary.data]);

  const emptyPhrases = useMemo(
    () =>
      entries
        .filter((entry) => !(drafts[entry.original_text] ?? '').trim())
        .map((entry) => entry.original_text),
    [entries, drafts],
  );
  const filled = entries.length - emptyPhrases.length;

  const dirty = useMemo(
    () =>
      entries.some(
        (entry) => (drafts[entry.original_text] ?? '') !== entry.translated_text,
      ),
    [entries, drafts],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Filtered on what is *saved*, so a row does not vanish under the owner's
  // fingers the moment they type its first letter.
  const shown = onlyMissing
    ? entries.filter((entry) => !entry.translated_text.trim())
    : entries;

  const busy = save.isPending || auto.isPending;

  async function handleAutoTranslate() {
    if (emptyPhrases.length === 0) return;
    let drafted = 0;
    let failed = 0;
    try {
      for (let start = 0; start < emptyPhrases.length; start += DRAFT_BATCH) {
        const result = await auto.mutateAsync(
          emptyPhrases.slice(start, start + DRAFT_BATCH),
        );
        drafted += result.entries.length;
        failed += result.failed.length;
        // Drafts land in the fields, unsaved. The owner reviews, edits, then
        // presses save — which is the entire point of this screen.
        setDrafts((current) => {
          const next = { ...current };
          for (const entry of result.entries)
            next[entry.original_text] = entry.translated_text;
          return next;
        });
      }
      if (failed > 0) {
        showError(
          `Przetłumaczono ${drafted} z ${drafted + failed}. Reszty nie udało się pobrać — uzupełnij ją ręcznie.`,
        );
      } else {
        showSuccess(`Wstawiono ${drafted} propozycji. Sprawdź je i zapisz.`);
      }
    } catch (error) {
      if (drafted > 0) {
        showError(
          `Wstawiono ${drafted} propozycji, potem wystąpił błąd: ${getApiErrorMessage(error)}`,
        );
      } else {
        showError(getApiErrorMessage(error));
      }
    }
  }

  async function handleSave() {
    try {
      await save.mutateAsync(
        entries.map((entry) => ({
          original_text: entry.original_text,
          translated_text: drafts[entry.original_text] ?? '',
        })),
      );
      showSuccess(
        `${capitalize(meta?.name ?? code)}: tłumaczenia zapisane — goście już je widzą.`,
      );
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  }

  if (dictionary.isError) {
    return <Alert severity="error">{getApiErrorMessage(dictionary.error)}</Alert>;
  }

  if (dictionary.isLoading) {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  }

  if (entries.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: radii.md }}>
        To menu nie ma jeszcze żadnych tekstów do przetłumaczenia. Dodaj kategorie i dania
        w Kreatorze menu, a pojawią się tutaj.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'center' } }}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            Przetłumaczono {filled} z {entries.length} fraz
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(filled / entries.length) * 100}
            sx={{ height: 8, borderRadius: radii.pill }}
          />
        </Box>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ flexShrink: 0, flexWrap: 'wrap' }}
          useFlexGap
        >
          <Button
            variant="outlined"
            onClick={() => void handleAutoTranslate()}
            disabled={busy || emptyPhrases.length === 0}
            startIcon={
              auto.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AutoAwesomeRoundedIcon />
              )
            }
          >
            {auto.isPending
              ? 'Tłumaczę…'
              : `Podpowiedz brakujące (${emptyPhrases.length})`}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={busy || !dirty}
            startIcon={
              save.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <SaveRoundedIcon />
              )
            }
          >
            Zapisz
          </Button>
        </Stack>
      </Stack>

      {auto.isPending && (
        <Alert severity="info">
          Pobieram propozycje z DeepL. Nic nie zostanie zapisane, dopóki ich nie
          sprawdzisz i nie klikniesz „Zapisz”.
        </Alert>
      )}
      {dirty && !busy && (
        <Alert severity="warning">
          Masz niezapisane zmiany — goście widzą jeszcze poprzednią wersję.
        </Alert>
      )}

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={onlyMissing}
            onChange={(event) => setOnlyMissing(event.target.checked)}
          />
        }
        label="Pokaż tylko nieprzetłumaczone"
        sx={{ alignSelf: 'flex-start', ml: 0 }}
      />

      <Paper variant="outlined" sx={{ borderRadius: radii.md, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          {['Oryginał (PL)', `${capitalize(meta?.name ?? code)} (${code})`].map(
            (heading) => (
              <Box
                key={heading}
                sx={{
                  display: { xs: 'none', md: 'block' },
                  px: 2.5,
                  py: 1.25,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03),
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {heading}
                </Typography>
              </Box>
            ),
          )}

          {shown.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1', px: 2.5, py: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Wszystko przetłumaczone. 🎉
              </Typography>
            </Box>
          )}

          {shown.map((entry) => {
            const value = drafts[entry.original_text] ?? '';
            const changed = value !== entry.translated_text;
            return (
              <Box key={entry.original_text} sx={{ display: 'contents' }}>
                <Box
                  sx={{
                    px: 2.5,
                    pt: 2,
                    pb: { xs: 0.5, md: 2 },
                    borderBottom: { md: '1px solid' },
                    borderColor: { md: 'divider' },
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ wordBreak: 'break-word', flexGrow: 1 }}
                  >
                    {entry.original_text}
                  </Typography>
                  {changed && (
                    <Chip
                      size="small"
                      label="zmienione"
                      color="warning"
                      variant="outlined"
                      sx={{ flexShrink: 0, height: 20, fontSize: 11 }}
                    />
                  )}
                </Box>
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <TextField
                    value={value}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [entry.original_text]: event.target.value,
                      }))
                    }
                    placeholder={`Tłumaczenie (${code})`}
                    size="small"
                    fullWidth
                    multiline
                    maxRows={4}
                    disabled={busy}
                    slotProps={{
                      htmlInput: {
                        'aria-label': `Tłumaczenie frazy: ${entry.original_text}`,
                        lang: language,
                        // Arabic and Hebrew type right to left.
                        dir: 'auto',
                      },
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary">
        Frazy bez tłumaczenia goście zobaczą po angielsku, a jeśli i tego brak — po
        polsku.
      </Typography>
    </Stack>
  );
}
