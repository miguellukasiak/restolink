import { memo, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider, alpha } from '@mui/material/styles';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import type { RestaurantThemeUpdate } from '../../types';
import { usePriceFormat } from '../../hooks/usePriceFormat';
import { createRestaurantTheme } from '../public/RestaurantThemeProvider';

export interface ThumbDish {
  name: string;
  price: number;
  image_url: string | null;
}

interface ThemeThumbProps {
  theme: RestaurantThemeUpdate;
  categoryName: string;
  dishes: ThumbDish[];
  logoUrl?: string | null;
}

/**
 * A menu in miniature, dressed in one theme: the restaurant's own first
 * category and dishes, so the gallery shows *their* menu in each look rather
 * than a stock screenshot. Built from the same theme factory as the guest
 * page, so colours, faces, pattern and card surface all match what a guest
 * would get — only the layout is simplified to fit a thumbnail.
 */
function ThemeThumbComponent({ theme, categoryName, dishes, logoUrl }: ThemeThumbProps) {
  const muiTheme = useMemo(() => createRestaurantTheme(theme), [theme]);
  const { menuDecor } = muiTheme;
  const { format: formatPrice } = usePriceFormat();

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        aria-hidden
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          p: 1,
          bgcolor: 'background.default',
          color: 'text.primary',
          overflow: 'hidden',
          ...(menuDecor.pattern ?? {}),
        }}
      >
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
              border: '1.5px solid',
              borderColor: (t) => alpha(t.palette.primary.main, 0.4),
              backgroundImage: logoUrl ? `url("${encodeURI(logoUrl)}")` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <Box sx={{ flex: 1 }} />
          {[0, 1].map((key) => (
            <Box
              key={key}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: '1.5px solid',
                borderColor: 'text.secondary',
                opacity: 0.5,
              }}
            />
          ))}
        </Stack>

        <Stack direction="row" spacing={0.5}>
          <Box
            sx={{ width: 30, height: 10, borderRadius: 999, bgcolor: 'primary.main' }}
          />
          {[22, 26].map((width) => (
            <Box
              key={width}
              sx={{
                width,
                height: 10,
                borderRadius: 999,
                bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
              }}
            />
          ))}
        </Stack>

        <Typography
          noWrap
          sx={(t) => ({
            fontFamily: t.typography.h5.fontFamily,
            fontWeight: t.typography.h5.fontWeight,
            fontSize: 13 * menuDecor.headingScale,
            lineHeight: 1.2,
            mt: 0.25,
            // noWrap clips overflow, which lets flexbox squeeze the line to
            // nothing when the dish grid below runs past the thumbnail.
            flexShrink: 0,
          })}
        >
          {categoryName}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0.75,
            alignContent: 'start',
            minHeight: 0,
          }}
        >
          {dishes.slice(0, 4).map((dish, index) => (
            <Box
              key={`${dish.name}-${index}`}
              sx={{
                borderRadius: '6px',
                overflow: 'hidden',
                bgcolor: menuDecor.cards ? 'background.paper' : 'transparent',
                boxShadow: menuDecor.cards ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              <Box
                sx={{
                  aspectRatio: '1 / 1',
                  borderRadius: '6px 6px 0 0',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                  color: (t) => alpha(t.palette.primary.main, 0.45),
                }}
              >
                {dish.image_url ? (
                  <Box
                    component="img"
                    src={dish.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <RestaurantMenuRoundedIcon sx={{ fontSize: 16 }} />
                )}
              </Box>
              <Box sx={{ px: 0.5, pt: 0.4, pb: 0.5 }}>
                <Typography noWrap sx={{ fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>
                  {dish.name}
                </Typography>
                <Typography
                  sx={{ fontSize: 8, fontWeight: 700, lineHeight: 1.3, opacity: 0.8 }}
                >
                  {formatPrice(dish.price)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export const ThemeThumb = memo(ThemeThumbComponent);
