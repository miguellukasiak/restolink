import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSaveTranslations, useTranslationDrafts } from '../../hooks/useDictionary';
import { useSnackbar } from '../feedback/SnackbarProvider';
import { getApiErrorMessage } from '../../services/api';
import { useLanguageName, usePanelT } from '../../i18n/panel';

const keyOf = (code: string, phrase: string) => `${code}\u0000${phrase}`;

/**
 * Right after a dish is saved: its new texts in every offered language that
 * lacks them, drafted by DeepL for the owner to check. Until now a new dish
 * waited, untranslated, until the owner happened to open "Languages", and a
 * guest reading Chinese met it in English meanwhile.
 *
 * Nothing is saved unread — the drafts are filled in, the owner saves. "Later"
 * keeps nothing; the gap stays counted on "Languages" and in the builder.
 */
export function DishTranslationDialog({
  restaurantId,
  gaps,
  onClose,
}: {
  restaurantId: string;
  /** Language → the phrases it lacks; null when closed. */
  gaps: ReadonlyMap<string, string[]> | null;
  onClose: () => void;
}) {
  const { t } = usePanelT();
  const languageName = useLanguageName();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const { showSuccess, showError } = useSnackbar();
  const drafts = useTranslationDrafts(restaurantId, gaps);
  const save = useSaveTranslations(restaurantId);
  // What the owner typed over a draft, by language and phrase.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const languages = gaps ? [...gaps] : [];
  const valueOf = (code: string, phrase: string) =>
    edits[keyOf(code, phrase)] ?? drafts.data?.get(code)?.get(phrase) ?? '';

  const entries = languages
    .map(([code, phrases]) => [
      code,
      phrases
        .map((phrase) => ({
          original_text: phrase,
          translated_text: valueOf(code, phrase).trim(),
        }))
        .filter((entry) => entry.translated_text !== ''),
    ])
    .filter(([, list]) => list.length > 0) as [
    string,
    { original_text: string; translated_text: string }[],
  ][];

  const close = () => {
    setEdits({});
    onClose();
  };

  const submit = () =>
    save.mutate(entries, {
      onSuccess: () => {
        showSuccess(t('dishTranslate.saved'));
        close();
      },
      onError: (error) => showError(getApiErrorMessage(error)),
    });

  return (
    <Dialog
      open={gaps !== null}
      onClose={save.isPending ? undefined : close}
      fullWidth
      maxWidth="sm"
      fullScreen={phone}
    >
      <DialogTitle sx={{ pb: 1 }}>{t('dishTranslate.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {t('dishTranslate.intro', {
            languages: languages.map(([code]) => languageName(code)).join(', '),
          })}
        </Typography>

        {drafts.isFetching && (
          <Box sx={{ mb: 2 }} aria-live="polite">
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="textSecondary">
              {t('dishTranslate.drafting')}
            </Typography>
          </Box>
        )}
        {drafts.isError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('dishTranslate.draftFailed')} {getApiErrorMessage(drafts.error)}
          </Alert>
        )}

        <Stack spacing={3}>
          {languages.map(([code, phrases]) => (
            <Box key={code} component="section" aria-label={languageName(code)}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                {languageName(code)}
              </Typography>
              <Stack spacing={1.5}>
                {phrases.map((phrase) => (
                  <Box key={phrase}>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      sx={{ display: 'block', mb: 0.5, whiteSpace: 'pre-line' }}
                    >
                      {phrase}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      maxRows={6}
                      value={valueOf(code, phrase)}
                      disabled={drafts.isFetching || save.isPending}
                      onChange={(event) =>
                        setEdits((previous) => ({
                          ...previous,
                          [keyOf(code, phrase)]: event.target.value,
                        }))
                      }
                      slotProps={{
                        htmlInput: {
                          'aria-label': t('dishTranslate.fieldAria', {
                            phrase,
                            language: languageName(code),
                          }),
                          lang: code,
                        },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={close} disabled={save.isPending}>
          {t('dishTranslate.later')}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={entries.length === 0 || drafts.isFetching || save.isPending}
          startIcon={
            save.isPending ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {save.isPending ? t('common.saving') : t('dishTranslate.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
