import { useMemo, useState, type KeyboardEvent, type ReactElement } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { radii } from '../../theme';

/** Mirrors MAX_LABEL_LENGTH and MAX_LABELS in the backend's menu_labels.py. */
export const MAX_LABEL_LENGTH = 40;
export const MAX_LABELS = 20;

interface ChoiceChipsProps {
  label: string;
  hint?: string;
  /** The built-in vocabulary, translated for guests in every language. */
  options: readonly string[];
  /** The owner's own labels already used elsewhere on the menu. */
  known?: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  iconFor: (option: string) => ReactElement;
  /** Warning for allergens (the guest filters them out), primary for tags. */
  tone: 'warning' | 'primary';
  /** Shown on the chip that adds the owner's own label. */
  addLabel: string;
  disabled?: boolean;
}

const fold = (text: string) => text.toLocaleLowerCase('pl');

/** "  orzeszki   ziemne " → "Orzeszki ziemne". */
function tidy(raw: string): string {
  const text = raw.split(/\s+/).filter(Boolean).join(' ');
  return text.charAt(0).toLocaleUpperCase('pl') + text.slice(1);
}

/**
 * A multi-select as a row of toggle chips: every option visible at once, one
 * tap each, with the same icons the guest sees on the menu.
 *
 * Beside the built-in vocabulary the owner can add their own — "Sezam",
 * "Z pieca" — and a label once used on any dish is offered on every other,
 * so the menu does not end up with "Sezam" and "sezam" as two allergens.
 * Typing a built-in by hand ("gluten") selects the built-in one: that is the
 * label guests get translated and can filter by.
 */
export function ChoiceChips({
  label,
  hint,
  options,
  known = [],
  value,
  onChange,
  iconFor,
  tone,
  addLabel,
  disabled = false,
}: ChoiceChipsProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Built-ins first, then the owner's own: those used elsewhere, then any
  // only this dish has (just added), each once whatever its case.
  const shown = useMemo(() => {
    const seen = new Set(options.map(fold));
    const custom: string[] = [];
    for (const entry of [...known, ...value]) {
      if (!seen.has(fold(entry))) {
        seen.add(fold(entry));
        custom.push(entry);
      }
    }
    return { all: [...options, ...custom], custom };
  }, [options, known, value]);

  const toggle = (option: string) =>
    onChange(
      value.includes(option)
        ? value.filter((entry) => entry !== option)
        : [...value, option],
    );

  const close = () => {
    setAdding(false);
    setDraft('');
    setError(null);
  };

  const commit = () => {
    const text = tidy(draft);
    if (!text) {
      close();
      return;
    }
    if (text.length > MAX_LABEL_LENGTH) {
      setError(`Najwyżej ${MAX_LABEL_LENGTH} znaków.`);
      return;
    }
    const existing = shown.all.find((option) => fold(option) === fold(text));
    const chosen = existing ?? text;
    if (!value.includes(chosen)) {
      if (value.length >= MAX_LABELS) {
        setError(`Najwyżej ${MAX_LABELS} pozycji na danie.`);
        return;
      }
      onChange([...value, chosen]);
    }
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Enter adds the label; it must not submit the whole dish.
      event.preventDefault();
      event.stopPropagation();
      commit();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  const customSelected = value.some((entry) => shown.custom.includes(entry));

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
        {shown.all.map((option) => {
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

        {adding ? (
          <Box
            sx={(t) => ({
              height: 36,
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              borderRadius: radii.pill,
              border: '1px solid',
              borderColor: error ? t.palette.error.main : t.palette[tone].main,
              bgcolor: 'background.paper',
            })}
          >
            <InputBase
              autoFocus
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={onKeyDown}
              onBlur={commit}
              placeholder="Wpisz i naciśnij Enter"
              inputProps={{
                'aria-label': addLabel,
                maxLength: MAX_LABEL_LENGTH + 10,
              }}
              sx={{ fontSize: 14, width: 190 }}
            />
          </Box>
        ) : (
          <Chip
            label={addLabel}
            icon={<AddRoundedIcon />}
            variant="outlined"
            clickable
            disabled={disabled}
            onClick={() => setAdding(true)}
            sx={(t) => ({
              height: 36,
              px: 0.5,
              borderStyle: 'dashed',
              borderColor: alpha(t.palette[tone].main, 0.6),
              color: t.palette[tone].dark,
              fontWeight: 600,
              '& .MuiChip-icon': { fontSize: 18, color: t.palette[tone].dark },
            })}
          />
        )}
      </Box>
      {error && (
        <Typography variant="caption" color="error" component="p" sx={{ mt: 0.75 }}>
          {error}
        </Typography>
      )}
      {customSelected && !error && (
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 0.75 }}
        >
          Własne pozycje przetłumaczysz w zakładce „Języki” — wbudowane tłumaczą się same.
        </Typography>
      )}
    </Box>
  );
}
