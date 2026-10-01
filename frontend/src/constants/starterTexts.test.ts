import { describe, expect, it } from 'vitest';
import { MENU_LANGUAGES } from './menuLanguages';
import { NOTE_MAX_LENGTH, NOTE_TEMPLATES } from './menu';
import { starterCategories, type StarterTexts } from './starterTexts';
import { TEXT_LIMITS, printedTextSets } from '../components/panel/qr/qrDesign';

const FILES = import.meta.glob<StarterTexts>('../i18n/starters/*.json', {
  import: 'default',
  eager: true,
});
const texts = (code: string) => FILES[`../i18n/starters/${code}.json`];
const MENU_BASE_LANGUAGES = MENU_LANGUAGES.map((language) => language.code);

describe('the starter texts', () => {
  it('exist for every language a menu can be written in, and no other', () => {
    expect(Object.keys(FILES).sort()).toEqual(
      MENU_BASE_LANGUAGES.map((code) => `../i18n/starters/${code}.json`).sort(),
    );
  });

  it.each(MENU_BASE_LANGUAGES)('are complete in %s', (code) => {
    const own = texts(code);
    expect(own.categories).toHaveLength(10);
    expect(new Set(own.categories).size).toBe(10);
    expect(starterCategories(own).every(Boolean)).toBe(true);
    for (const { key } of NOTE_TEMPLATES) {
      expect(own.notes[key], key).toBeTruthy();
      expect(own.notes[key].length).toBeLessThanOrEqual(NOTE_MAX_LENGTH);
    }
    expect(own.qr.steps).toHaveLength(3);
    for (const value of [own.qr.cta, own.qr.ctaShort, own.qr.footer, own.qr.footerShort])
      expect(value.trim()).toBe(value);
  });

  it.each(MENU_BASE_LANGUAGES)(
    'print within the QR limits in %s, alone or with English',
    (code) => {
      for (const set of printedTextSets(code, texts(code), texts('en'))) {
        // Built by joining, so nothing may need cutting to fit.
        expect(set.cta.length, `${set.id} cta`).toBeLessThanOrEqual(TEXT_LIMITS.cta);
        expect(set.footer.length, `${set.id} footer`).toBeLessThanOrEqual(
          TEXT_LIMITS.footer,
        );
        for (const step of set.steps)
          expect(step.length, `${set.id} step`).toBeLessThanOrEqual(TEXT_LIMITS.step);
        if (set.id.includes('+')) {
          expect(set.cta).toBe(`${texts(code).qr.ctaShort} · ${texts('en').qr.ctaShort}`);
        }
      }
    },
  );

  it('start a Polish menu with what it always started with', () => {
    const pl = texts('pl');
    expect(starterCategories(pl)).toEqual([
      'Przystawki',
      'Dania główne',
      'Desery',
      'Napoje',
    ]);
    expect(printedTextSets('pl', pl, texts('en')).map((set) => set.label)).toEqual([
      'Polski',
      'English',
      'Polski + English',
    ]);
  });
});
