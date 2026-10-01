import { useCallback, type ReactNode, type Ref } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight';

/** The width the content is laid out at: a common phone's CSS viewport. */
export const PHONE_VIEWPORT_WIDTH = 390;

/** Bezel thickness on each side, in px. */
export const PHONE_BEZEL = 10;
const BEZEL = PHONE_BEZEL;

/**
 * Outer height ÷ width of a current phone (an iPhone 15 is 147.6 × 71.6 mm).
 * Keeping to it is what makes the mockup read as a phone at any size; a frame
 * whose height is squeezed on its own looks like a toy.
 */
export const PHONE_ASPECT = 2.06;

interface PhoneFrameProps {
  /** Laid out at `PHONE_VIEWPORT_WIDTH` and scaled down to fit the screen. */
  children: ReactNode;
  /** Shown in the faux address bar. */
  address: string;
  /** Outer width of the device, in px. */
  width?: number;
  /**
   * Height of the screen (inside the bezel), as any CSS length. Defaults to a
   * real phone's proportions for `width` — see useFittedPhone.
   */
  screenHeight?: number | string;
  /** The element that scrolls — for callers that scroll the preview. */
  scrollRef?: Ref<HTMLDivElement>;
  /** Changes whenever the content may have been swapped without resizing. */
  measureKey?: string | number | boolean;
  /**
   * What the dynamic island says when it opens, like a phone's live
   * notification. Without it the island is the plain black notch.
   */
  island?: ReactNode;
  /** Opens the island over the top of the screen, showing `island`. */
  islandOpen?: boolean;
}

/**
 * A phone showing a real page, used by the owner panel's live previews.
 *
 * The content is laid out at a phone's real width and scaled down, so what
 * the owner sees is the guest's layout rather than a squeezed desktop one.
 */
export function PhoneFrame({
  children,
  address,
  width = 320,
  screenHeight = Math.round(width * PHONE_ASPECT) - BEZEL * 2,
  scrollRef,
  measureKey,
  island,
  islandOpen = false,
}: PhoneFrameProps) {
  const open = Boolean(island) && islandOpen;
  const scale = (width - BEZEL * 2) / PHONE_VIEWPORT_WIDTH;

  const content = useMeasuredHeight(measureKey);
  // The visible page area, so a short page (an empty menu) can still fill
  // it: a real browser paints the page's background down to the bottom of
  // the screen, not just behind the content.
  const viewport = useMeasuredHeight(measureKey);
  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewport.ref.current = node;
      if (typeof scrollRef === 'function') scrollRef(node);
      else if (scrollRef) scrollRef.current = node;
    },
    [viewport.ref, scrollRef],
  );

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        borderRadius: '44px',
        p: `${BEZEL}px`,
        background: 'linear-gradient(155deg, #3a3a42 0%, #1C1B22 45%, #000000 100%)',
        boxShadow:
          '0 24px 64px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255,255,255,0.08)',
        position: 'relative',
      }}
    >
      {/* Volume + power buttons */}
      {[
        { side: 'left', top: 108, height: 28 },
        { side: 'left', top: 144, height: 46 },
        { side: 'right', top: 130, height: 58 },
      ].map((button) => (
        <Box
          key={`${button.side}-${button.top}`}
          aria-hidden
          sx={{
            position: 'absolute',
            [button.side]: -2,
            top: button.top,
            width: 3,
            height: button.height,
            bgcolor: '#000',
            borderRadius: button.side === 'left' ? '2px 0 0 2px' : '0 2px 2px 0',
          }}
        />
      ))}

      {/* Screen — fixed browser chrome on top, scrolling page below. */}
      <Box
        sx={{
          height: screenHeight,
          borderRadius: '34px',
          overflow: 'hidden',
          position: 'relative',
          bgcolor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Dynamic island. Grows into a notification the way a real one
            does (wider, taller, rounder at the ends), and shrinks back to
            the notch. Size changes are transitions, so a hidden tab, which
            runs none, still lands on the right state (CLAUDE.md, trap 8). */}
        <Box
          aria-hidden={island ? undefined : true}
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: open ? 'calc(100% - 24px)' : 90,
            height: open ? 44 : 24,
            bgcolor: '#000',
            borderRadius: open ? '22px' : '12px',
            zIndex: 3,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: open ? '0 6px 18px rgba(0, 0, 0, 0.28)' : 'none',
            transition:
              'width 0.5s cubic-bezier(0.2, 0.9, 0.25, 1.15), height 0.5s cubic-bezier(0.2, 0.9, 0.25, 1.15), border-radius 0.5s ease, box-shadow 0.5s ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          {island && (
            <Box
              sx={{
                px: 1.75,
                minWidth: 0,
                color: '#FFFFFF',
                opacity: open ? 1 : 0,
                // The words come in once the island has grown, and leave
                // before it shrinks.
                transition: open ? 'opacity 0.25s ease 0.25s' : 'opacity 0.12s ease',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              {island}
            </Box>
          )}
        </Box>

        {/* Faux mobile browser chrome. Deliberately neutral: it is the phone's
            UI, not the restaurant's, so it stays the same over a dark menu. */}
        <Box
          sx={{
            flexShrink: 0,
            pt: '40px',
            px: 1.5,
            pb: 1.25,
            bgcolor: '#F2F2F7',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: 'center',
              justifyContent: 'center',
              px: 1.5,
              py: 0.5,
              borderRadius: 999,
              bgcolor: '#FFFFFF',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
            }}
          >
            <LockRoundedIcon sx={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.45)' }} />
            <Typography
              sx={{ fontSize: 11, fontWeight: 500, color: 'rgba(0, 0, 0, 0.6)' }}
              noWrap
            >
              {address}
            </Typography>
          </Stack>
        </Box>

        <Box
          ref={setViewport}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {/* An isolating stacking context plus the measured height (see
              useMeasuredHeight), so the scaled, sticky content can never
              escape the screen's clip or leave dead scroll space. */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              overflow: 'hidden',
              height: content.height !== null ? content.height * scale : 'auto',
            }}
          >
            <Box
              ref={content.ref}
              sx={{
                width: PHONE_VIEWPORT_WIDTH,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                // At least a screen tall, with the page stretched to fill it.
                minHeight: viewport.height !== null ? viewport.height / scale : undefined,
                display: 'flex',
                flexDirection: 'column',
                '& > *': { flexGrow: 1 },
              }}
            >
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
