import { describe, expect, it } from 'vitest';
import { MENU_LANGUAGES, languageTag } from './menuLanguages';

describe('the short labels of languages', () => {
  it('read like the country, as internet domains do', () => {
    expect(languageTag('uk')).toBe('UA');
    expect(languageTag('cs')).toBe('CZ');
    expect(languageTag('zh')).toBe('CN');
    expect(languageTag('de')).toBe('DE');
    expect(languageTag('pl')).toBe('PL');
  });

  it('give every language its own two capitals, and none of them UK', () => {
    const tags = MENU_LANGUAGES.map((language) => languageTag(language.code));
    for (const tag of tags) expect(tag).toMatch(/^[A-Z]{2}$/);
    expect(new Set(tags).size).toBe(tags.length);
    // English and Ukrainian were both read as the United Kingdom.
    expect(tags).not.toContain('UK');
    expect(languageTag('en')).toBe('EN');
  });
});
