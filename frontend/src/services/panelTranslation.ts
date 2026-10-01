import en from '../i18n/panel/en.json';
import {
  fetchPanelLocale,
  savePanelLocale,
  translateInterface,
  type PanelLocale,
} from './panelLocaleService';

/*
 * Makes the owner panel in a new language with DeepL, from the HQ browser —
 * which holds the panel's English (src/i18n/panel/en.json); the server holds
 * the key and stores the result (backend/app/routers/panel_locales.py).
 *
 * Only what is missing, or whose English has changed since, is sent, so a
 * language is paid for once and a later deploy's new strings cost only
 * themselves.
 *
 * Plurals are the one hard part. English has two forms ("1 dish", "5
 * dishes"); Ukrainian needs four, Polish four, Turkish one. For every form
 * the target language needs, DeepL is given the sentence with a number that
 * falls in that form ("2 dishes" for Ukrainian "few"), and the number in its
 * answer is turned back into {{count}}. If the number does not come back as
 * written, the sentence is translated again with {{count}} itself.
 */

type Tree = { [key: string]: string | Tree };

const PLURAL = /_(zero|one|two|few|many|other)$/;
const BATCH = 50;

export function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out[prefix + key] = value;
    else Object.assign(out, flatten(value, `${prefix}${key}.`));
  }
  return out;
}

/**
 * A number that falls in `category` in `language` — the plainest one: small
 * integers first, then larger ones, then fractions (Ukrainian "other" is
 * only ever a fraction).
 */
export function sampleFor(language: string, category: Intl.LDMLPluralRule): number {
  const rules = new Intl.PluralRules(language);
  const candidates = [
    ...(category === 'one' ? [1] : []),
    ...Array.from({ length: 19 }, (_, index) => index + 2),
    ...Array.from({ length: 180 }, (_, index) => index + 21),
    1,
    0,
    1.5,
    0.5,
    2.5,
    1_000_000,
  ];
  return candidates.find((n) => rules.select(n) === category) ?? 5;
}

/** One string to make: its key, what DeepL is sent, and what it came from. */
export interface Job {
  key: string;
  text: string;
  /** The English it came from — stored, to spot a change later. */
  source: string;
  /** For a plural form: the number written into `text`. */
  sample?: number;
  /** For a plural form: the English with {{count}}, the fallback. */
  template?: string;
}

/** What a language still needs, against what is stored. */
export function plan(
  language: string,
  english: Record<string, string>,
  stored: PanelLocale | null,
): Job[] {
  const done = (key: string, source: string) =>
    stored?.sources[key] === source && Boolean(stored.strings[key]);
  const jobs: Job[] = [];
  const plurals = new Map<string, { one?: string; other?: string }>();

  for (const [key, text] of Object.entries(english)) {
    const match = key.match(PLURAL);
    if (!match) {
      if (!done(key, text)) jobs.push({ key, text, source: text });
      continue;
    }
    const base = key.replace(PLURAL, '');
    const forms = plurals.get(base) ?? {};
    if (match[1] === 'one') forms.one = text;
    else forms.other = text;
    plurals.set(base, forms);
  }

  const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  for (const [base, forms] of plurals) {
    const other = forms.other ?? forms.one ?? '';
    const source = `${forms.one ?? ''}|${other}`;
    for (const category of categories) {
      const key = `${base}_${category}`;
      if (done(key, source)) continue;
      const sample = sampleFor(language, category);
      const template = sample === 1 && forms.one ? forms.one : other;
      jobs.push({
        key,
        text: template.replaceAll('{{count}}', String(sample)),
        source,
        sample,
        template,
      });
    }
  }
  return jobs;
}

/** Puts {{count}} back where DeepL wrote the sample number; null if absent. */
export function restoreCount(
  text: string,
  sample: number,
  language: string,
): string | null {
  const written = new Set([
    String(sample),
    sample.toLocaleString(language),
    String(sample).replace('.', ','),
  ]);
  for (const form of written) {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\d.,])${escaped}(?![\\d])`);
    if (pattern.test(text)) return text.replace(pattern, '{{count}}');
  }
  return null;
}

/** One batch's results, with plural numbers turned back into {{count}}. */
async function translateBatch(
  language: string,
  batch: Job[],
): Promise<{ strings: Record<string, string>; sources: Record<string, string> }> {
  const strings: Record<string, string> = {};
  const sources: Record<string, string> = {};
  const results = await translateInterface(
    language,
    batch.map((job) => job.text),
  );
  const retry: Job[] = [];
  batch.forEach((job, index) => {
    const result = results[index] ?? '';
    const text =
      job.sample === undefined ? result : restoreCount(result, job.sample, language);
    if (text === null || !text.trim()) {
      if (job.template) retry.push(job);
      return;
    }
    strings[job.key] = text;
    sources[job.key] = job.source;
  });

  // Plural forms whose number did not come back as written: the sentence
  // again, with {{count}} itself, which DeepL leaves alone.
  if (retry.length > 0) {
    const second = await translateInterface(
      language,
      retry.map((job) => job.template ?? job.text),
    );
    retry.forEach((job, index) => {
      if (second[index]?.trim()) {
        strings[job.key] = second[index];
        sources[job.key] = job.source;
      }
    });
  }
  return { strings, sources };
}

/**
 * Makes or completes `language`. Reports progress as (done, total); resolves
 * with how many strings it made.
 *
 * Each batch is saved as soon as it is translated, so stopping midway — the
 * dialog closed, the tab shut, DeepL refusing — loses at most one batch, and
 * the next run sends only what is still missing. `signal` stops it between
 * batches. Even with nothing to translate it saves once, so a language with
 * no row yet gets its messages and emails.
 */
export async function translatePanel(
  language: string,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<number> {
  const english = flatten(en as Tree);
  const stored = await fetchPanelLocale(language);
  const jobs = plan(language, english, stored);
  let made = 0;
  onProgress(0, jobs.length);

  if (jobs.length === 0 && !stored) await savePanelLocale(language, {}, {});
  for (let start = 0; start < jobs.length; start += BATCH) {
    if (signal?.aborted) break;
    const batch = jobs.slice(start, start + BATCH);
    const { strings, sources } = await translateBatch(language, batch);
    await savePanelLocale(language, strings, sources);
    made += Object.keys(strings).length;
    onProgress(start + batch.length, jobs.length);
  }
  return made;
}

/** How many strings a finished `language` has: every English key, with each
 *  plural in as many forms as the language needs. */
export function expectedStrings(language: string): number {
  return plan(language, flatten(en as Tree), null).length;
}

/** Where a panel language stands, for HQ's picker. */
export type PanelLanguageState = 'built-in' | 'ready' | 'missing';

export function panelLanguageState(
  language: string,
  made: { code: string; strings: number }[] | undefined,
): PanelLanguageState {
  if (language === 'en' || language === 'pl') return 'built-in';
  const row = made?.find((entry) => entry.code === language);
  // Fewer strings than the panel now has: made before newer ones existed.
  return row && row.strings >= expectedStrings(language) ? 'ready' : 'missing';
}
