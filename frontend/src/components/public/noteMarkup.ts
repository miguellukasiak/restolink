/*
 * The small markup a note may carry, and nothing more:
 *
 *   **bold**   *italic*   "# " starts a heading line   "- " a list item
 *
 * Parsed here into plain data and turned into elements by React — never into
 * an HTML string — so whatever an owner types, it cannot inject markup. Text
 * without any of it reads exactly as it did before notes had formatting.
 */

export type Inline = { text: string; bold?: boolean; italic?: boolean };

export type NoteBlock =
  | { kind: 'heading'; inlines: Inline[] }
  | { kind: 'paragraph'; lines: Inline[][] }
  | { kind: 'list'; items: Inline[][] };

const EMPHASIS = /\*\*(.+?)\*\*|\*(.+?)\*/g;

/** One line's bold and italic runs. Unpaired asterisks stay as typed. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(EMPHASIS)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ text: line.slice(last, at) });
    if (match[1] !== undefined) out.push({ text: match[1], bold: true });
    else out.push({ text: match[2], italic: true });
    last = at + match[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

const HEADING = /^#\s+/;
const ITEM = /^[-•]\s+/;

/** A note's text as headings, paragraphs and lists, in order. */
export function parseNote(body: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  for (const line of body.split('\n')) {
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      // A blank line ends the paragraph or list; the next line starts anew.
      blocks.push({ kind: 'paragraph', lines: [] });
    } else if (HEADING.test(line)) {
      blocks.push({ kind: 'heading', inlines: parseInline(line.replace(HEADING, '')) });
    } else if (ITEM.test(line)) {
      const inlines = parseInline(line.replace(ITEM, ''));
      if (last?.kind === 'list') last.items.push(inlines);
      else blocks.push({ kind: 'list', items: [inlines] });
    } else if (last?.kind === 'paragraph') {
      last.lines.push(parseInline(line));
    } else {
      blocks.push({ kind: 'paragraph', lines: [parseInline(line)] });
    }
  }
  return blocks.filter((block) => block.kind !== 'paragraph' || block.lines.length > 0);
}

/** The words alone — for labels, excerpts and anything else read aloud. */
export function plainNote(body: string): string {
  return body
    .split('\n')
    .map((line) =>
      parseInline(line.replace(HEADING, '').replace(ITEM, ''))
        .map((run) => run.text)
        .join(''),
    )
    .join('\n');
}
