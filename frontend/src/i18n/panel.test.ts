import { describe, expect, it } from 'vitest';
import en from './panel/en.json';
import pl from './panel/pl.json';
import { BUILT_IN_PANEL_LANGUAGES, PANEL_LANGUAGES } from './panel';
import { MENU_LANGUAGES } from '../constants/menuLanguages';

/*
 * The owner panel's translations. A missing key renders as the key itself
 * ("dishForm.name") and a forgotten Polish string sits in the English panel
 * looking fine to anyone who reads Polish — so both are caught here, where
 * they cost nothing, rather than by an owner.
 */

type Tree = { [key: string]: string | Tree };

const LOCALES: Record<string, Tree> = { en, pl };
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(prefix + key, value);
    else for (const entry of flatten(value, `${prefix}${key}.`)) out.set(...entry);
  }
  return out;
}

/** Keys with their plural suffix taken off: what code asks `t` for. */
const baseKeys = (tree: Tree) =>
  new Set([...flatten(tree).keys()].map((key) => key.replace(PLURAL, '')));

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{\s*(\w+)/g)].map((match) => match[1]).sort();

/** Every source file, as text; the panel's are the ones that import it. */
const SOURCES = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

describe('the owner panel translations', () => {
  it('exist for every hand-written panel language', () => {
    expect(Object.keys(LOCALES).sort()).toEqual([...BUILT_IN_PANEL_LANGUAGES].sort());
  });

  it('can be made by DeepL for every other catalogue language read left to right', () => {
    // Mirrors backend/app/panel_language.py: English and Polish by hand, then
    // the catalogue without English and without right-to-left languages.
    const expected = [
      'en',
      'pl',
      ...MENU_LANGUAGES.filter((language) => language.code !== 'en' && !language.rtl).map(
        (language) => language.code,
      ),
    ];
    expect([...PANEL_LANGUAGES]).toEqual(expected);
    expect(PANEL_LANGUAGES).not.toContain('ar');
  });

  it('have the same strings in every language', () => {
    const reference = baseKeys(en);
    for (const [code, tree] of Object.entries(LOCALES)) {
      expect([...baseKeys(tree)].sort(), code).toEqual([...reference].sort());
    }
  });

  it('give every plural the forms its language needs', () => {
    for (const [code, tree] of Object.entries(LOCALES)) {
      const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
      const forms = new Map<string, Set<string>>();
      for (const key of flatten(tree).keys()) {
        const match = key.match(PLURAL);
        if (!match) continue;
        const base = key.replace(PLURAL, '');
        forms.set(base, (forms.get(base) ?? new Set()).add(match[1]));
      }
      for (const [base, have] of forms) {
        for (const category of needed) {
          expect(have.has(category), `${code}: ${base}_${category}`).toBe(true);
        }
      }
    }
  });

  it('keep every placeholder in every language', () => {
    const byBase = (tree: Tree) => {
      const out = new Map<string, Set<string>>();
      for (const [key, text] of flatten(tree)) {
        const base = key.replace(PLURAL, '');
        const set = out.get(base) ?? new Set<string>();
        for (const name of placeholders(text)) if (name !== 'count') set.add(name);
        out.set(base, set);
      }
      return out;
    };
    const reference = byBase(en);
    for (const [code, tree] of Object.entries(LOCALES)) {
      for (const [base, names] of byBase(tree)) {
        expect([...names].sort(), `${code}: ${base}`).toEqual(
          [...(reference.get(base) ?? [])].sort(),
        );
      }
    }
  });

  it('have every key the panel asks for', () => {
    const known = baseKeys(en);
    const prefixes = new Set(
      [...known].flatMap((key) => {
        const parts = key.split('.');
        return parts
          .slice(1)
          .map((_, index) => `${parts.slice(0, index + 1).join('.')}.`);
      }),
    );
    const missing: string[] = [];
    for (const [path, source] of Object.entries(SOURCES)) {
      if (!source.includes("i18n/panel'")) continue;
      const code = stripComments(source);
      // t('a.b'), tp('a.b'), and schema messages: .min(2, 'a.b')
      for (const match of code.matchAll(
        /\b(?:t|tp)\(\s*'([\w.-]+)'|\.(?:min|max|regex|refine|email)\([^)]*?'([a-zA-Z]+\.[\w.-]+)'/g,
      )) {
        const key = match[1] ?? match[2];
        if (!known.has(key)) missing.push(`${path}: ${key}`);
      }
      // t(`a.b.${x}`): the fixed part must lead somewhere.
      for (const match of code.matchAll(/\b(?:t|tp)\(\s*`([\w.-]*)\$\{/g)) {
        if (!prefixes.has(match[1])) missing.push(`${path}: ${match[1]}…`);
      }
    }
    expect(missing).toEqual([]);
  });
});

/**
 * Where the owner panel lives. Files and lines left out on purpose are
 * listed in ALLOWED with the reason they may hold Polish.
 */
const PANEL_CODE = [
  '../components/panel/',
  '../components/auth/',
  '../components/layout/RestaurantPanelLayout.tsx',
  '../pages/panel/',
  '../pages/auth/',
  '../hooks/',
  '../constants/',
  '../services/api.ts',
  '../utils/',
];

const ALLOWED: Record<string, string> = {
  '../pages/auth/HqAccessPage.tsx': 'the HQ door; the HQ panel is Polish',
  '../components/panel/ImpersonationBanner.tsx': 'read by HQ staff, not the owner',
  '../components/panel/qr/qrDesign.ts': 'printed for guests, in the menu language',
  '../components/panel/qr/qrTemplates.ts': 'printed for guests, in the menu language',
  '../constants/menu.ts': 'stored menu vocabulary and category names — menu content',
  '../constants/menuIcons.tsx': 'keyed by the stored (Polish) values',
};

describe('the owner panel code', () => {
  it('holds no Polish text outside the translation files', () => {
    const polish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
    const found: string[] = [];
    for (const [path, source] of Object.entries(SOURCES)) {
      if (!PANEL_CODE.some((root) => path.startsWith(root)) || path in ALLOWED) continue;
      stripComments(source)
        .split('\n')
        .forEach((line, index) => {
          // A character class in a slug, not text anyone reads.
          if (polish.test(line) && !/\.replace\(\/[^/]*\//.test(line)) {
            found.push(`${path}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(found).toEqual([]);
  });
});
