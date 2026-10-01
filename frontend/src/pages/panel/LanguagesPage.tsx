import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { ConfirmDialog } from '../../components/panel/ConfirmDialog';
import { UnsavedChangesGuard } from '../../components/panel/UnsavedChangesGuard';
import { AddLanguagePanel } from '../../components/panel/languages/AddLanguagePanel';
import { OfferedLanguages } from '../../components/panel/languages/OfferedLanguages';
import { ReachHero } from '../../components/panel/languages/ReachHero';
import { TranslationEditor } from '../../components/panel/languages/TranslationEditor';
import { CONFIRM_LANGUAGES_OVER } from '../../constants/menuLanguages';
import { useLanguageName, usePanelT } from '../../i18n/panel';
import { useMenuLanguages, useSaveMenuLanguages } from '../../hooks/useMenuLanguages';
import { getApiErrorMessage } from '../../services/api';
import { radii } from '../../theme';

/** How long the translations glow after a language is added. */
const SPOTLIGHT_MS = 2400;

function Section({
  title,
  hint,
  spotlight = false,
  children,
}: {
  title: string;
  hint?: string;
  /** A ring for a moment, where the page has just sent the owner. */
  spotlight?: boolean;
  children: ReactNode;
}) {
  return (
    <Paper
      elevation={1}
      sx={{
        borderRadius: radii.lg,
        p: { xs: 2, sm: 3 },
        outline: '2px solid',
        outlineColor: (theme) => (spotlight ? theme.palette.primary.main : 'transparent'),
        outlineOffset: 2,
        transition: 'outline-color 0.4s ease',
      }}
    >
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {hint}
        </Typography>
      )}
      {!hint && <Box sx={{ mb: 2 }} />}
      {children}
    </Paper>
  );
}

/**
 * "Języki" — which languages guests can read the menu in.
 *
 * It opens on the world: how many people can read this menu now, where they
 * are, and what one more language would change. Under it, the languages on
 * offer with how far each has got, the ones worth adding where the
 * restaurant is, and the translations themselves.
 *
 * The screen is built to encourage the right languages rather than many:
 * every candidate shows how many *new* readers it brings (so English-reading
 * Scandinavia shows up as the small step it is), the upkeep is counted in
 * translations per new dish, and past a few languages the page says so —
 * past ten, it asks.
 */
export default function LanguagesPage() {
  const { t } = usePanelT();
  const languageName = useLanguageName();
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();
  const data = useMenuLanguages(restaurantId);
  const save = useSaveMenuLanguages(restaurantId);

  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const spotlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(spotlightTimer.current), []);

  const offered = data.data?.languages ?? [];
  const base = data.data?.base_language ?? 'pl';
  const country = data.data?.country ?? 'PL';
  const languages = [base, ...offered];
  const candidates = (data.data?.available ?? []).filter(
    (code) => !offered.includes(code),
  );
  const phrasesTotal = data.data?.phrases_total ?? 0;

  const translated = useCallback(
    (code: string) =>
      data.data?.progress.find((entry) => entry.code === code)?.translated ?? 0,
    [data.data],
  );

  // The language in the editor: the one picked, else the first offered.
  const current = editing && offered.includes(editing) ? editing : (offered[0] ?? null);

  const openEditor = (code: string) => {
    if (code === current) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (editorDirty) {
      setPendingEdit(code);
      return;
    }
    setEditing(code);
    // After the switch has rendered, so the section is at its new height.
    setTimeout(
      () => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      50,
    );
  };

  /**
   * Takes the owner from where they added a language — often the map at the
   * top — to its translations, and rings them for a moment. Added without
   * this, the language only produced a snackbar, and it looked done while
   * guests would still read the menu in Polish.
   */
  const showTranslations = (code: string) => {
    if (editorDirty) return; // They are mid-edit in another language; stay.
    setEditing(code);
    // After the new language's editor has rendered in its place.
    setTimeout(
      () => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80,
    );
    clearTimeout(spotlightTimer.current);
    setSpotlight(true);
    // A timer, not an animation: a hidden tab would freeze an animation on
    // its first frame (CLAUDE.md, trap 7).
    spotlightTimer.current = setTimeout(() => setSpotlight(false), SPOTLIGHT_MS);
  };

  const needsTranslating = (code: string) =>
    phrasesTotal > 0 && translated(code) < phrasesTotal;

  const commit = (next: string[], message: string) => {
    save.mutate(next, {
      onSuccess: () => showSuccess(message),
      onError: (error) => showError(getApiErrorMessage(error)),
    });
  };

  const add = (code: string) => {
    if (offered.includes(code)) return;
    if (offered.length >= CONFIRM_LANGUAGES_OVER) {
      setPendingAdd(code);
      return;
    }
    const name = languageName(code);
    commit(
      [...offered, code],
      needsTranslating(code)
        ? t('languages.addedTranslate', { name })
        : t('languages.addedReady', { name }),
    );
    setPreview(null);
    if (needsTranslating(code)) showTranslations(code);
    else if (!editorDirty) setEditing(code);
  };

  const remove = (code: string) => {
    commit(
      offered.filter((entry) => entry !== code),
      t('languages.hidden', { name: languageName(code) }),
    );
  };

  if (data.isError) {
    return (
      <Box sx={{ maxWidth: 1360, mx: 'auto', pt: 4 }}>
        <Alert severity="error">{getApiErrorMessage(data.error)}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1360, mx: 'auto', pt: 4 }}>
      {/* Unsaved translations: their Save lives in the editor. */}
      <UnsavedChangesGuard when={editorDirty} />
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('nav.languages')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('languages.subtitle')}
        </Typography>
      </Stack>

      {data.isLoading || !data.data ? (
        <Stack spacing={3}>
          <Skeleton variant="rounded" height={420} sx={{ borderRadius: radii.lg }} />
          <Skeleton variant="rounded" height={320} sx={{ borderRadius: radii.lg }} />
        </Stack>
      ) : (
        <Stack spacing={3}>
          <ReachHero
            languages={languages}
            candidates={candidates}
            externalPreview={preview}
            home={country}
            onAdd={add}
            onSelectLanguage={openEditor}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Section title={t('languages.yours')} hint={t('languages.yoursHint')}>
              <OfferedLanguages
                base={base}
                offered={offered}
                phrasesTotal={phrasesTotal}
                translated={translated}
                editing={current}
                busy={save.isPending}
                onEdit={openEditor}
                onRemove={remove}
              />
            </Section>

            <Section title={t('languages.add')} hint={t('languages.addHint')}>
              <AddLanguagePanel
                country={country}
                languages={languages}
                phrasesTotal={phrasesTotal}
                translated={translated}
                busy={save.isPending}
                onAdd={add}
                onPreview={setPreview}
              />
            </Section>
          </Box>

          <Box ref={editorRef} sx={{ scrollMarginTop: 88 }}>
            <Section
              title={t('languages.translations')}
              hint={t('languages.translationsHint')}
              spotlight={spotlight}
            >
              {current ? (
                <Stack spacing={2.5}>
                  <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {offered.map((code) => {
                      const share = phrasesTotal ? translated(code) / phrasesTotal : 1;
                      return (
                        <Chip
                          key={code}
                          label={`${languageName(code)} · ${Math.round(
                            Math.min(share, 1) * 100,
                          )}%`}
                          color={code === current ? 'primary' : 'default'}
                          variant={code === current ? 'filled' : 'outlined'}
                          onClick={() => openEditor(code)}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      );
                    })}
                  </Stack>
                  <TranslationEditor
                    key={current}
                    restaurantId={restaurantId}
                    language={current}
                    onDirtyChange={setEditorDirty}
                  />
                </Stack>
              ) : (
                <Alert severity="info" sx={{ borderRadius: radii.md }}>
                  {t('languages.addFirst')}
                </Alert>
              )}
            </Section>
          </Box>
        </Stack>
      )}

      <ConfirmDialog
        open={pendingEdit !== null}
        title={t('languages.discardTitle')}
        description={t('languages.discardBody')}
        confirmLabel={t('dishForm.discard')}
        onConfirm={() => {
          if (pendingEdit) setEditing(pendingEdit);
          setEditorDirty(false);
          setPendingEdit(null);
        }}
        onClose={() => setPendingEdit(null)}
      />

      <ConfirmDialog
        open={pendingAdd !== null}
        title={t('languages.manyTitle', { count: offered.length + 1 })}
        confirmColor="primary"
        confirmLabel={t('languages.addAnyway')}
        description={t('languages.manyBody', {
          languages: t('count.languages', { count: offered.length + 1 }),
          phrases: t('count.phrases', { count: phrasesTotal }),
          name: pendingAdd ? languageName(pendingAdd) : t('languages.thisLanguage'),
        })}
        onConfirm={() => {
          const code = pendingAdd;
          setPendingAdd(null);
          if (!code) return;
          commit([...offered, code], t('languages.added', { name: languageName(code) }));
          if (needsTranslating(code)) showTranslations(code);
        }}
        onClose={() => setPendingAdd(null)}
      />
    </Box>
  );
}
