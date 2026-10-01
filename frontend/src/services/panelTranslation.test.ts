import { describe, expect, it } from 'vitest';
import { plan, restoreCount, sampleFor } from './panelTranslation';

describe('the plural samples', () => {
  it('finds a number in every form a language needs', () => {
    expect(sampleFor('uk', 'one')).toBe(1);
    expect(sampleFor('uk', 'few')).toBe(2);
    expect(sampleFor('uk', 'many')).toBe(5);
    expect(sampleFor('uk', 'other')).toBe(1.5);
    expect(sampleFor('ja', 'other')).toBe(2);
    expect(sampleFor('sl', 'two')).toBe(2);
    expect(sampleFor('fr', 'many')).toBe(1_000_000);
  });
});

describe('what a language still needs', () => {
  const english = {
    'nav.builder': 'Menu builder',
    'count.dishes_one': '{{count}} dish',
    'count.dishes_other': '{{count}} dishes',
  };

  it('asks for every plural form of the target language, with a number in it', () => {
    const jobs = plan('uk', english, null);
    expect(Object.fromEntries(jobs.map((job) => [job.key, job.text]))).toEqual({
      'nav.builder': 'Menu builder',
      'count.dishes_one': '1 dish',
      'count.dishes_few': '2 dishes',
      'count.dishes_many': '5 dishes',
      'count.dishes_other': '1.5 dishes',
    });
    // Japanese has a single form.
    expect(plan('ja', english, null).map((job) => job.key)).toEqual([
      'nav.builder',
      'count.dishes_other',
    ]);
  });

  it('skips what is stored and still matches its English', () => {
    const stored = {
      code: 'uk',
      strings: { 'nav.builder': 'Конструктор меню' },
      sources: { 'nav.builder': 'Menu builder' },
    };
    expect(plan('uk', english, stored).map((job) => job.key)).not.toContain(
      'nav.builder',
    );
    const changed = { ...stored, sources: { 'nav.builder': 'Builder' } };
    expect(plan('uk', english, changed).map((job) => job.key)).toContain('nav.builder');
  });
});

describe('putting the count back', () => {
  it('finds the number however the language writes it', () => {
    expect(restoreCount('2 страви', 2, 'uk')).toBe('{{count}} страви');
    expect(restoreCount('1,5 страви', 1.5, 'uk')).toBe('{{count}} страви');
    // "12" is not the sample "2".
    expect(restoreCount('12 страв, 2 страви', 2, 'uk')).toBe(
      '12 страв, {{count}} страви',
    );
    expect(restoreCount('дві страви', 2, 'uk')).toBeNull();
  });
});
