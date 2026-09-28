import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { BRAND_FONT_FAMILY } from '../../theme';

interface WordmarkProps {
  /** Font size in px. The mark is set once per surface, so this is explicit
   *  rather than a variant — a nav bar and a login screen want different
   *  weights of presence, not different type scale steps. */
  size?: number;
  /** Defaults to the surrounding text colour, so it works on the light app
   *  chrome and on a dark footer without a variant for each. */
  color?: string;
  component?: React.ElementType;
  sx?: SxProps<Theme>;
}

/**
 * The RestoLink wordmark.
 *
 * This replaced a rounded square holding the letter "R". A single glyph in a
 * coloured tile is the logo of an app nobody has heard of yet: it carries no
 * name, and at the three places it appeared — both login screens and both
 * navigation bars — it was competing with the word "RestoLink" printed
 * directly beside it. Setting the name itself in a display face does the job
 * the tile was there to do.
 *
 * Dela Gothic One is loaded in `index.html` and used *only* here. It has one
 * weight and no italic, which is why it stays out of the body font stack.
 */
export function Wordmark({
  size = 20,
  color = 'inherit',
  component = 'span',
  sx,
}: WordmarkProps) {
  return (
    <Typography
      component={component}
      sx={{
        fontFamily: BRAND_FONT_FAMILY,
        fontSize: size,
        // Dela Gothic One ships a single weight; asking for 700 would invite
        // the browser to synthesise a bolder one and smear the letterforms.
        fontWeight: 400,
        // The face is wide by design, so it is pulled in slightly to keep the
        // name compact enough for a toolbar.
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color,
        whiteSpace: 'nowrap',
        ...sx,
      }}
    >
      RestoLink
    </Typography>
  );
}
