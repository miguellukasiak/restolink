import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  COUNTRIES,
  CURRENCIES,
  MAX_ADDRESS_LENGTH,
  countryName,
  currencyName,
} from '../../constants/countries';
import { MENU_LANGUAGES, getMenuLanguage } from '../../constants/menuLanguages';
import { panelLanguageLabel as polishName } from './panelLanguageLabel';

import type { RestaurantLocation } from './location';

/** Sorted the way an HQ operator looks for them: by Polish name. */
const COUNTRY_CODES = Object.keys(COUNTRIES).sort((a, b) =>
  countryName(a, 'pl').localeCompare(countryName(b, 'pl'), 'pl'),
);

/** Polish first — most restaurants' — then the rest of the catalogue. */
const MENU_BASE_LANGUAGES = [
  'pl',
  ...MENU_LANGUAGES.map((language) => language.code).filter((code) => code !== 'pl'),
];

const languageLabel = (code: string) => {
  const own = getMenuLanguage(code)?.endonym ?? code;
  const name = polishName(code);
  return name.toLocaleLowerCase('pl') === own.toLocaleLowerCase('pl')
    ? name
    : `${name} · ${own}`;
};

const currencyLabel = (code: string) => `${code} · ${currencyName(code, 'pl')}`;

/**
 * "Gdzie jest restauracja" — HQ's half of everything that used to assume
 * Poland. The country pins the restaurant on the owner's languages map and
 * decides what is recommended there; the currency and the menu's language
 * start from it and follow it when it changes, unless HQ set them by hand.
 */
export function LocationFields({
  value,
  onChange,
  disabled = false,
  /** Shown once the menu's language differs from what is saved. */
  languageWarning,
}: {
  value: RestaurantLocation;
  onChange: (next: RestaurantLocation) => void;
  disabled?: boolean;
  languageWarning?: string;
}) {
  const changeCountry = (country: string) => {
    const [oldCurrency, oldLanguage] = COUNTRIES[value.country] ?? [];
    const [currency, language] = COUNTRIES[country];
    onChange({
      ...value,
      country,
      // Follow the country, unless HQ chose something else on purpose.
      currency: value.currency === oldCurrency ? currency : value.currency,
      base_language: value.base_language === oldLanguage ? language : value.base_language,
    });
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Gdzie jest restauracja
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          columnGap: 2,
          rowGap: 2.5,
        }}
      >
        <Autocomplete
          options={COUNTRY_CODES}
          value={value.country}
          onChange={(_event, next) => next && changeCountry(next)}
          getOptionLabel={(code) => countryName(code, 'pl')}
          disableClearable
          autoHighlight
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Kraj"
              helperText="Mapa i polecane języki w panelu"
            />
          )}
        />
        <TextField
          label="Adres (opcjonalnie)"
          placeholder="ulica, numer, miasto"
          value={value.address}
          onChange={(event) =>
            onChange({
              ...value,
              address: event.target.value.slice(0, MAX_ADDRESS_LENGTH),
            })
          }
          disabled={disabled}
          helperText=" "
        />
        <Autocomplete
          options={MENU_BASE_LANGUAGES}
          value={value.base_language}
          onChange={(_event, next) => next && onChange({ ...value, base_language: next })}
          getOptionLabel={languageLabel}
          disableClearable
          autoHighlight
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Język menu"
              helperText={languageWarning ?? 'W nim restaurator wpisuje dania'}
              slotProps={{
                ...params.slotProps,
                formHelperText: {
                  sx: languageWarning ? { color: 'warning.dark' } : undefined,
                },
              }}
            />
          )}
        />
        <Autocomplete
          options={CURRENCIES as string[]}
          value={value.currency}
          onChange={(_event, next) => next && onChange({ ...value, currency: next })}
          getOptionLabel={currencyLabel}
          disableClearable
          autoHighlight
          disabled={disabled}
          renderInput={(params) => (
            <TextField {...params} label="Waluta cen" helperText="Ceny w menu gościa" />
          )}
        />
      </Box>
    </Box>
  );
}
