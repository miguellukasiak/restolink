import { describe, expect, it } from 'vitest';
import { parseInline, parseNote, plainNote } from './noteMarkup';
import { NOTE_ICONS, noteIconComponent, noteLook } from './noteIcons';
import { NOTE_TEMPLATES } from '../../constants/menu';
import en from '../../i18n/panel/en.json';

describe('the note markup', () => {
  it('reads bold and italic runs, and leaves a lone asterisk as typed', () => {
    expect(parseInline('Mięso **craftowe**, *świeże* i 5*')).toEqual([
      { text: 'Mięso ' },
      { text: 'craftowe', bold: true },
      { text: ', ' },
      { text: 'świeże', italic: true },
      { text: ' i 5*' },
    ]);
  });

  it('splits a note into a heading, paragraphs and a list', () => {
    const blocks = parseNote(
      '# Menu obiadowe\nPon–pt, **12–16**.\nZestaw dnia:\n- zupa\n- danie dnia\n\nSmacznego!',
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'paragraph',
    ]);
    expect(blocks[1]).toEqual({
      kind: 'paragraph',
      lines: [
        [{ text: 'Pon–pt, ' }, { text: '12–16', bold: true }, { text: '.' }],
        [{ text: 'Zestaw dnia:' }],
      ],
    });
  });

  it('reads a note without markup exactly as before', () => {
    const body = 'Menu obiadowe podawane jest od 12:00.\n\nZupa + danie dnia.';
    expect(plainNote(body)).toBe(body);
    expect(parseNote(body).map((block) => block.kind)).toEqual([
      'paragraph',
      'paragraph',
    ]);
  });

  it('never treats typed HTML as markup', () => {
    // Runs are text for React to escape; nothing here is ever set as HTML.
    expect(parseInline('<b>x</b><script>alert(1)</script>')).toEqual([
      { text: '<b>x</b><script>alert(1)</script>' },
    ]);
  });

  it('gives the words alone for labels', () => {
    expect(plainNote('# Tytuł\n- **jeden**\n- *dwa*')).toBe('Tytuł\njeden\ndwa');
  });
});

describe('the note looks', () => {
  it('fills in the look a note stored before it had one', () => {
    expect(noteLook(undefined)).toEqual({ icon: 'info', variant: 'card', align: 'left' });
    expect(noteLook({ icon: null })).toEqual({
      icon: null,
      variant: 'card',
      align: 'left',
    });
  });

  it('draws an icon the list no longer has as the default, and none as none', () => {
    expect(noteIconComponent('retired-icon')).toBe(NOTE_ICONS.info);
    expect(noteIconComponent(null)).toBeNull();
  });

  it('names every icon in the panel, and the templates use known ones', () => {
    for (const key of Object.keys(NOTE_ICONS)) {
      expect(en.noteDialog.icons, key).toHaveProperty(key);
    }
    for (const template of NOTE_TEMPLATES) {
      expect(NOTE_ICONS, template.key).toHaveProperty(template.icon);
    }
  });
});
