import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import { useParams } from 'react-router-dom';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import {
  useAutoTranslate,
  useDictionary,
  useSaveDictionary,
} from '../../hooks/useDictionary';
import { getApiErrorMessage } from '../../services/api';

/** Languages an owner can maintain, matching DICTIONARY_LANGUAGES server-side. */
const LANGUAGES = [
  { code: 'en', label: 'Angielski (EN)' },
  { code: 'de', label: 'Niemiecki (DE)' },
  { code: 'fr', label: 'Francuski (FR)' },
  { code: 'es', label: 'Hiszpański (ES)' },
] as const;

/**
 * The owner's translation dictionary.
 *
 * This screen exists because machine translation was not good enough for a
 * menu: the free translator rendered "Smażony ser" as "Gekochter Käse" —
 * *boiled* cheese. Auto-translate still lives here, but only as a first draft
 * the owner corrects; nothing reaches a guest until they press save.
 */
export function DictionaryPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();

  const [targetLang, setTargetLang] = useState<string>('en');
  /** Edits in progress, keyed by the original phrase. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const dictionary = useDictionary(restaurantId, targetLang);
  const save = useSaveDictionary(restaurantId, targetLang);
  const auto = useAutoTranslate(restaurantId, targetLang);

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

  const filled = useMemo(
    () => entries.filter((entry) => (drafts[entry.original_text] ?? '').trim()).length,
    [entries, drafts],
  );

  const emptyPhrases = useMemo(
    () =>
      entries
        .filter((entry) => !(drafts[entry.original_text] ?? '').trim())
        .map((entry) => entry.original_text),
    [entries, drafts],
  );

  const dirty = useMemo(
    () =>
      entries.some(
        (entry) => (drafts[entry.original_text] ?? '') !== entry.translated_text,
      ),
    [entries, drafts],
  );

  const busy = save.isPending || auto.isPending;

  async function handleAutoTranslate() {
    if (emptyPhrases.length === 0) return;
    try {
      const result = await auto.mutateAsync(emptyPhrases);
      // Drafts land in the fields, unsaved. The owner reviews, edits, then
      // presses save — which is the entire point of this screen.
      setDrafts((current) => {
        const next = { ...current };
        for (const entry of result.entries) {
          next[entry.original_text] = entry.translated_text;
        }
        return next;
      });

      if (result.failed.length > 0) {
        showError(
          `Przetłumaczono ${result.entries.length} z ${emptyPhrases.length}. ` +
            `Reszty nie udało się pobrać — uzupełnij ją ręcznie.`,
        );
      } else {
        showSuccess(
          `Wstawiono ${result.entries.length} propozycji. Sprawdź je i zapisz.`,
        );
      }
    } catch (error) {
      showError(getApiErrorMessage(error));
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
      showSuccess('Tłumaczenia zapisane.');
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
            Słownik tłumaczeń
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tłumaczenia, które zobaczą goście skanujący kod QR. Automat podpowiada
            — ostatnie słowo należy do Ciebie.
          </Typography>
        </Box>

        <TextField
          select
          label="Język docelowy"
          value={targetLang}
          onChange={(event) => setTargetLang(event.target.value)}
          size="small"
          disabled={busy}
          sx={{ minWidth: 200 }}
        >
          {LANGUAGES.map((language) => (
            <MenuItem key={language.code} value={language.code}>
              {language.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {dictionary.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {getApiErrorMessage(dictionary.error)}
        </Alert>
      )}

      {dictionary.isLoading ? (
        <Stack spacing={1.5}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} variant="rounded" height={64} />
          ))}
        </Stack>
      ) : entries.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '16px' }}>
          To menu nie ma jeszcze żadnych tekstów do przetłumaczenia. Dodaj
          kategorie i dania w Kreatorze menu, a pojawią się tutaj.
        </Alert>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                    Przetłumaczono {filled} z {entries.length} fraz
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={entries.length ? (filled / entries.length) * 100 : 0}
                    sx={{ height: 8, borderRadius: '999px' }}
                  />
                </Box>

                <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
                  <Button
                    variant="outlined"
                    onClick={handleAutoTranslate}
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
                      : `Przetłumacz automatycznie (${emptyPhrases.length})`}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={busy || !dirty}
                    startIcon={
                      save.isPending ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <SaveRoundedIcon />
                      )
                    }
                  >
                    Zapisz zmiany
                  </Button>
                </Stack>
              </Stack>

              {auto.isPending && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Tłumaczenie idzie po jednej frazie z przerwami, żeby nie
                  przekroczyć limitów darmowej usługi — przy długim menu potrwa
                  to nawet kilkadziesiąt sekund. Nie zamykaj tej karty.
                </Alert>
              )}

              {dirty && !busy && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Masz niezapisane zmiany.
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 0,
              }}
            >
              <Box
                sx={{
                  display: { xs: 'none', md: 'block' },
                  px: 2.5,
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  Oryginał ({dictionary.data?.base_language.toUpperCase()})
                </Typography>
              </Box>
              <Box
                sx={{
                  display: { xs: 'none', md: 'block' },
                  px: 2.5,
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  Tłumaczenie ({targetLang.toUpperCase()})
                </Typography>
              </Box>

              {entries.map((entry) => {
                const value = drafts[entry.original_text] ?? '';
                const changed = value !== entry.translated_text;
                return (
                  <Box
                    key={entry.original_text}
                    sx={{
                      display: 'contents',
                    }}
                  >
                    <Box
                      sx={{
                        px: 2.5,
                        py: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
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
                        placeholder={`Wpisz tłumaczenie (${targetLang.toUpperCase()})`}
                        size="small"
                        fullWidth
                        multiline
                        maxRows={4}
                        disabled={busy}
                        slotProps={{
                          htmlInput: {
                            'aria-label': `Tłumaczenie frazy: ${entry.original_text}`,
                          },
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Card>

          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 2, alignItems: 'center', color: 'text.secondary' }}
          >
            <TranslateRoundedIcon fontSize="small" />
            <Typography variant="caption">
              Frazy bez tłumaczenia goście zobaczą po angielsku, a jeśli i tego
              brak — w oryginale.
            </Typography>
          </Stack>
        </>
      )}
    </Box>
  );
}
