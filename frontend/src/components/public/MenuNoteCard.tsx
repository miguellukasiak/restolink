import { Fragment, memo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { MenuNoteStyle } from '../../types';
import { contrastRatio, getContrastingTextColor } from '../../utils/colors';
import { parseNote, type Inline } from './noteMarkup';
import { noteIconComponent, noteLook } from './noteIcons';

const WIDE = '@container (min-width: 576px)';

/** 3:1 is what an icon — a graphic, not text — needs to be made out. */
const brandReadable = (brand: string, background: string) =>
  contrastRatio(brand, background) >= 3;

function Runs({ inlines }: { inlines: Inline[] }) {
  return inlines.map((run, index) =>
    run.bold ? (
      <Box component="strong" key={index} sx={{ fontWeight: 700 }}>
        {run.text}
      </Box>
    ) : run.italic ? (
      <em key={index}>{run.text}</em>
    ) : (
      <Fragment key={index}>{run.text}</Fragment>
    ),
  );
}

/**
 * A note's text with its markup rendered: headings in the theme's heading
 * face, paragraphs, lists. Sized by its parent (everything is `inherit` or
 * relative), so the guest card and the builder's block can share it.
 */
export function NoteText({
  body,
  align = 'left',
}: {
  body: string;
  align?: MenuNoteStyle['align'];
}) {
  const theme = useTheme();
  return (
    <Stack
      spacing={0.75}
      sx={{ minWidth: 0, textAlign: align, overflowWrap: 'anywhere' }}
    >
      {parseNote(body).map((block, index) =>
        block.kind === 'heading' ? (
          <Typography
            key={index}
            variant="inherit"
            component="p"
            sx={{
              fontFamily: theme.typography.h5.fontFamily,
              fontWeight: theme.typography.h5.fontWeight ?? 700,
              fontSize: `${1.2 * (theme.menuDecor?.headingScale ?? 1)}em`,
              lineHeight: 1.3,
            }}
          >
            <Runs inlines={block.inlines} />
          </Typography>
        ) : block.kind === 'list' ? (
          <Box
            key={index}
            component="ul"
            sx={{
              m: 0,
              pl: 2.5,
              textAlign: 'left',
              // Centred, the list keeps its bullets lined up and sits in the
              // middle as one piece.
              alignSelf: align === 'center' ? 'center' : 'stretch',
            }}
          >
            {block.items.map((item, itemIndex) => (
              <Typography key={itemIndex} variant="inherit" component="li">
                <Runs inlines={item} />
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography key={index} variant="inherit" component="p">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Runs inlines={line} />
              </Fragment>
            ))}
          </Typography>
        ),
      )}
    </Stack>
  );
}

interface MenuNoteCardProps {
  body: string;
  style?: Partial<MenuNoteStyle>;
}

/**
 * The owner's own text between the menu's sections — lunch hours, what a set
 * menu consists of, "craft meat in our kebab" — as a guest sees it.
 *
 * Three looks: a frame in the brand's tint ("card"), the brand colour itself
 * ("filled") and the text alone ("plain"). Every one stays readable whatever
 * colours the owner picked (utils/colors.ts): text takes the on-background
 * colour the theme derived, or on the brand colour the contrasting one; over
 * a pattern the card and the plain text get a solid surface like every dish;
 * and the icon falls back to the text colour when the brand colour would
 * vanish against the background.
 */
function MenuNoteCardComponent({ body, style }: MenuNoteCardProps) {
  const theme = useTheme();
  const look = noteLook(style);
  const Icon = noteIconComponent(look.icon);
  const brand = theme.palette.primary.main;
  const onBrand = getContrastingTextColor(brand);
  const filled = look.variant === 'filled';
  const surface = theme.menuDecor?.cards ? theme.palette.background.paper : 'transparent';
  const tint = alpha(brand, 0.07);
  const centered = look.align === 'center';

  return (
    <Box
      role="note"
      sx={{
        display: 'flex',
        flexDirection: centered ? 'column' : 'row',
        alignItems: centered ? 'center' : 'flex-start',
        gap: centered ? 0.75 : 1.25,
        px: look.variant === 'plain' && !theme.menuDecor?.cards ? 0.5 : 1.75,
        py: 1.5,
        borderRadius: '16px',
        fontSize: 13.5,
        lineHeight: 1.55,
        [WIDE]: { fontSize: 14.5 },
        ...(filled
          ? { bgcolor: brand, color: onBrand }
          : {
              color: 'text.primary',
              bgcolor: surface,
              ...(look.variant === 'card' && {
                border: '1px solid',
                borderColor: alpha(brand, 0.28),
                // Laid over the surface, so a pattern never shows through.
                backgroundImage: `linear-gradient(${tint}, ${tint})`,
              }),
            }),
      }}
    >
      {Icon && (
        <Icon
          aria-hidden
          sx={{
            fontSize: centered ? 24 : 20,
            mt: centered ? 0 : '1px',
            flexShrink: 0,
            color: filled
              ? onBrand
              : brandReadable(brand, theme.palette.background.default)
                ? 'primary.main'
                : 'text.primary',
          }}
        />
      )}
      <NoteText body={body} align={look.align} />
    </Box>
  );
}

export const MenuNoteCard = memo(MenuNoteCardComponent);
