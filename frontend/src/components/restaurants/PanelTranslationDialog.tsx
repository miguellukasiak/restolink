import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { getApiErrorMessage } from '../../services/api';
import { translatePanel } from '../../services/panelTranslation';
import { panelLocaleQueryKeys } from '../../hooks/usePanelLocales';
import { panelLanguageLabel as polishName } from './panelLanguageLabel';

/** "1 tekst", "3 teksty", "700 tekstów". */
const texts = (count: number) => {
  const form = new Intl.PluralRules('pl').select(count);
  return `${count} ${form === 'one' ? 'tekst' : form === 'few' ? 'teksty' : 'tekstów'}`;
};

type Run =
  | { state: 'working'; done: number; total: number }
  | { state: 'done'; made: number }
  | { state: 'failed'; message: string };

/**
 * Translates the owner panel into `code` with DeepL, right after HQ saved a
 * restaurant with that language, and shows how far it has got.
 *
 * The restaurant is already saved, and each batch is stored as it arrives:
 * closing this midway leaves the rest of its panel in English for now, and
 * saving the restaurant again (or any other with the same language) picks up
 * where it stopped — only the missing strings go out.
 */
export function PanelTranslationDialog({
  code,
  onClose,
}: {
  code: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [run, setRun] = useState<Run>({ state: 'working', done: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!code) return;
    // Closing stops it between batches; what is done is already saved.
    const controller = new AbortController();
    const live = () => !controller.signal.aborted;
    setRun({ state: 'working', done: 0, total: 0 });
    translatePanel(
      code,
      (done, total) => {
        if (live()) setRun({ state: 'working', done, total });
      },
      controller.signal,
    )
      .then((made) => {
        if (live()) setRun({ state: 'done', made });
      })
      .catch((error: unknown) => {
        if (live()) setRun({ state: 'failed', message: getApiErrorMessage(error) });
      })
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: panelLocaleQueryKeys.statuses });
      });
    return () => controller.abort();
  }, [code, attempt, queryClient]);

  const name = code ? polishName(code).toLocaleLowerCase('pl') : '';
  const percent = run.state === 'working' && run.total ? (run.done / run.total) * 100 : 0;

  return (
    <Dialog open={code !== null} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Panel restauratora: {name}</DialogTitle>
      <DialogContent>
        {run.state === 'working' && (
          <>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              DeepL tłumaczy panel, maile i komunikaty — raz, dla wszystkich restauracji z
              tym językiem.
            </Typography>
            <LinearProgress
              // Remounted when it turns determinate, so it starts empty
              // rather than sliding back from the indeterminate animation.
              key={run.total ? 'determinate' : 'indeterminate'}
              variant={run.total ? 'determinate' : 'indeterminate'}
              value={percent}
              sx={{ height: 8, borderRadius: '999px' }}
            />
            <Typography
              variant="caption"
              color="textSecondary"
              component="p"
              sx={{ mt: 1 }}
            >
              {run.total
                ? `${run.done} z ${run.total} tekstów`
                : 'Sprawdzam, czego brakuje…'}
            </Typography>
          </>
        )}
        {run.state === 'done' && (
          <Alert severity="success">
            {run.made > 0
              ? `Gotowe — przetłumaczono ${texts(run.made)}. Restaurator zobaczy panel w tym języku w przełączniku u góry.`
              : 'Panel w tym języku był już gotowy.'}
          </Alert>
        )}
        {run.state === 'failed' && (
          <Alert severity="error">
            {run.message} Restauracja jest zapisana; do czasu tłumaczenia jej panel
            pokazuje się po angielsku.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {run.state === 'failed' && (
          <Button onClick={() => setAttempt((value) => value + 1)}>
            Spróbuj ponownie
          </Button>
        )}
        <Button
          onClick={onClose}
          variant={run.state === 'working' ? 'text' : 'contained'}
          color={run.state === 'working' ? 'inherit' : 'primary'}
        >
          {run.state === 'working' ? 'Dokończ później' : 'Zamknij'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
