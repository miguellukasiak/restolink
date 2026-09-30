import { describe, expect, it } from 'vitest';
import { MENU_LANGUAGES } from '../../../constants/menuLanguages';
import worldMap from './worldCountries.json';
import {
  COUNTRY_SHARES,
  bestLanguageFor,
  coverage,
  coverageStep,
  formatPeople,
  gain,
  languagesReadIn,
  reach,
} from './reach';

const countries = worldMap.countries;
const world = countries.reduce((sum, country) => sum + country.pop, 0);
const catalogue = MENU_LANGUAGES.map((language) => language.code);

describe('the share table', () => {
  it('covers every country on the map, and nothing else', () => {
    const onMap = new Set(countries.map((country) => country.key));
    expect(countries.filter((country) => !COUNTRY_SHARES[country.key])).toEqual([]);
    expect(Object.keys(COUNTRY_SHARES).filter((key) => !onMap.has(key))).toEqual([]);
  });

  it('holds shares between 0 and 1, for known languages only', () => {
    const known = new Set([...catalogue, 'pl']);
    for (const [key, shares] of Object.entries(COUNTRY_SHARES)) {
      for (const [language, share] of Object.entries(shares)) {
        expect(known.has(language), `${key}: ${language}`).toBe(true);
        expect(share > 0 && share <= 1, `${key}: ${language}=${share}`).toBe(true);
      }
    }
  });

  it('gives every catalogue language somewhere it is read', () => {
    for (const code of catalogue) {
      expect(gain(countries, ['pl'], code), code).toBeGreaterThan(0);
    }
  });
});

describe('reach', () => {
  it('starts from the Polish-speaking world', () => {
    const base = reach(countries, ['pl']);
    expect(base).toBeGreaterThan(35e6);
    expect(base).toBeLessThan(45e6);
  });

  it('makes English the biggest single step from Polish', () => {
    const steps = catalogue.map((code) => ({
      code,
      gain: gain(countries, ['pl'], code),
    }));
    steps.sort((a, b) => b.gain - a.gain);
    expect(steps[0].code).toBe('en');
    expect(steps[0].gain).toBeGreaterThan(1e9);
  });

  it('never shrinks when a language is added, and never exceeds the world', () => {
    let languages = ['pl'];
    let previous = reach(countries, languages);
    for (const code of catalogue) {
      languages = [...languages, code];
      const next = reach(countries, languages);
      expect(next, code).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
    expect(previous).toBeLessThanOrEqual(world);
  });

  it('counts a person once: a second language adds only those it newly reaches', () => {
    // Swedes read English well; Swedish after English is a small step,
    // Swedish before English a whole country.
    const swedishFirst = gain(countries, ['pl'], 'sv');
    const swedishAfterEnglish = gain(countries, ['pl', 'en'], 'sv');
    expect(swedishAfterEnglish).toBeLessThan(swedishFirst * 0.2);
  });

  it('does not depend on the order languages were added in', () => {
    const a = reach(countries, ['pl', 'en', 'de', 'zh']);
    const b = reach(countries, ['zh', 'de', 'pl', 'en']);
    expect(Math.abs(a - b)).toBeLessThan(1);
  });

  it('bounds each country by its population', () => {
    for (const country of countries) {
      const all = coverage(country.key, [...catalogue, 'pl']);
      expect(all, country.key).toBeLessThanOrEqual(1);
    }
  });
});

describe('the map helpers', () => {
  it('suggests the language a country reads best', () => {
    expect(bestLanguageFor('CN', ['pl', 'en'], catalogue)?.code).toBe('zh');
    expect(bestLanguageFor('DE', ['pl'], catalogue)?.code).toBe('de');
    // Switzerland: German first, French once German is in.
    expect(bestLanguageFor('CH', ['pl', 'de'], catalogue)?.code).toBe('en');
  });

  it('suggests nothing where nothing more is read', () => {
    expect(bestLanguageFor('BD', ['pl', 'en'], catalogue)).toBeNull();
  });

  it('draws coverage in four plain steps', () => {
    expect([0, 0.08, 0.1, 0.49, 0.5, 0.84, 0.85, 1].map(coverageStep)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
  });

  it('names who reads the menu in a country, most read first', () => {
    expect(languagesReadIn('LT', ['pl', 'en', 'de'])).toEqual(['en', 'pl']);
    expect(languagesReadIn('BD', ['pl'])).toEqual([]);
  });

  it("counts a country's official language as read by nearly everyone", () => {
    // A native-speaker share promised an owner 93% of Lithuania with Lithuanian.
    for (const [key, code] of [
      ['LT', 'lt'],
      ['LV', 'lv'],
      ['EE', 'et'],
      ['FI', 'fi'],
      ['PL', 'pl'],
    ] as const) {
      expect(coverageStep(coverage(key, [code])), key).toBe(3);
    }
  });

  it('writes numbers the way people say them', () => {
    // Intl keeps the number and its unit together with a no-break space.
    const say = (value: number, locale?: string) =>
      formatPeople(value, locale).replace(/\u00a0/g, ' ');
    expect(say(1_612_000_000)).toBe('1,6 mld');
    expect(say(41_300_000)).toBe('41 mln');
    expect(say(2_340_000)).toBe('2,3 mln');
    expect(say(850_000)).toBe('850 tys.');
    expect(say(1_612_000_000, 'en')).toBe('1.6B');
    expect(say(41_300_000, 'en')).toBe('41M');
    expect(say(850_000, 'en')).toBe('850K');
  });
});
