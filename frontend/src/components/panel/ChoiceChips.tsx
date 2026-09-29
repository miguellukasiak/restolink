import type { ReactElement } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

interface ChoiceChipsProps {
  label: string;
  hint?: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  iconFor: (option: string) => ReactElement;
  /** Warning for allergens (the guest filters them out), primary for tags. */
  tone: 'warning' | 'primary';
  disabled?: boolean;
}

/**
 * A multi-select as a row of toggle chips: every option visible at once, one
 * tap each, with the same icons the guest sees on the menu. Replaces a
 * two-column checkbox grid that read like a form to be filled in rather than
 * a dish being described.
 */
export function ChoiceChips({
  label,
  hint,
  options,
  value,
  onChange,
  iconFor,
  tone,
  disabled = false,
}: ChoiceChipsProps) {
  const toggle = (option: string) =>
    onChange(
      value.includes(option)
        ? value.filter((entry) => entry !== option)
        : [...value, option],
    );

  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Typography component="legend" variant="subtitle2" sx={{ p: 0 }}>
          {label}
        </Typography>
        {value.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            Zaznaczone: {value.length}
          </Typography>
        )}
      </Stack>
      {hint && (
        <Typography variant="caption" color="text.secondary" component="p">
          {hint}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <Chip
              key={option}
              label={option}
              icon={iconFor(option)}
              variant="outlined"
              clickable
              disabled={disabled}
              onClick={() => toggle(option)}
              aria-pressed={selected}
              sx={(t) => {
                const main = t.palette[tone].main;
                return {
                  height: 36,
                  px: 0.5,
                  fontWeight: selected ? 700 : 500,
                  borderColor: selected ? main : t.palette.divider,
                  bgcolor: selected ? alpha(main, 0.12) : 'transparent',
                  color: selected ? t.palette[tone].dark : t.palette.text.primary,
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                  '& .MuiChip-icon': {
                    fontSize: 18,
                    color: selected ? t.palette[tone].dark : t.palette.text.secondary,
                  },
                  '&&:hover': { bgcolor: alpha(main, selected ? 0.18 : 0.06) },
                };
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
