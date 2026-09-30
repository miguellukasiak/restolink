import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { contrastRatio } from '../../utils/colors';

const WIDE = '@container (min-width: 576px)';

/** 3:1 is what an icon — a graphic, not text — needs to be made out. */
const brandReadable = (brand: string, background: string) =>
  contrastRatio(brand, background) >= 3;

interface MenuNoteCardProps {
  body: string;
}

/**
 * The owner's own text between the menu's sections — lunch hours, what a set
 * menu consists of — as a guest sees it.
 *
 * A quiet panel in the restaurant's colour, so it reads as information about
 * the menu rather than as another dish. Its text takes the on-background
 * colour the theme derived from the restaurant's background, and over a
 * pattern it gets a solid surface like every dish card, so it stays readable
 * whatever colours the owner picked (utils/colors.ts). The icon falls back to
 * the text colour when the brand colour would vanish against the background.
 * Line breaks are the owner's and are kept.
 */
function MenuNoteCardComponent({ body }: MenuNoteCardProps) {
  return (
    <Box
      role="note"
      sx={(theme) => {
        const tint = alpha(theme.palette.primary.main, 0.07);
        return {
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
          px: 1.75,
          py: 1.5,
          borderRadius: '16px',
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.28),
          bgcolor: theme.menuDecor?.cards ? 'background.paper' : 'transparent',
          // Laid over the surface, so the pattern never shows through the text.
          backgroundImage: `linear-gradient(${tint}, ${tint})`,
        };
      }}
    >
      <InfoOutlinedIcon
        aria-hidden
        sx={(theme) => ({
          fontSize: 20,
          mt: '1px',
          flexShrink: 0,
          color: brandReadable(
            theme.palette.primary.main,
            theme.palette.background.default,
          )
            ? 'primary.main'
            : 'text.primary',
        })}
      />
      <Typography
        sx={{
          fontSize: 13.5,
          lineHeight: 1.55,
          [WIDE]: { fontSize: 14.5 },
          color: 'text.primary',
          whiteSpace: 'pre-line',
          overflowWrap: 'anywhere',
          minWidth: 0,
        }}
      >
        {body}
      </Typography>
    </Box>
  );
}

export const MenuNoteCard = memo(MenuNoteCardComponent);
