import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../../i18n';

/**
 * Language control for the public menu.
 *
 * Small on purpose: detection usually gets this right, and the switcher only
 * exists for the guest it got wrong. It shows the active code ("DE") next to a
 * globe rather than spelling the language out, so it stays a header-sized
 * control rather than a banner.
 *
 * Changing the language does two things at once, both implicit: react-i18next
 * re-renders the static interface, and `usePublicMenu` keys its query by
 * language, so the menu's own content is refetched in the new language without
 * anything here having to ask for it.
 *
 * Options are labelled with endonyms — "Deutsch", not "German" — because a
 * switcher written in a language you cannot read is no use to you.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const active = (i18n.resolvedLanguage ?? i18n.language ?? 'pl').split('-')[0];

  const open = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const close = () => setAnchor(null);

  const choose = (code: string) => {
    void i18n.changeLanguage(code);
    close();
  };

  return (
    <>
      <Button
        onClick={open}
        aria-label={t('languageSwitcher')}
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        startIcon={<LanguageRoundedIcon />}
        color="inherit"
        size="small"
        sx={{ flexShrink: 0, fontWeight: 700, minWidth: 0, px: 1 }}
      >
        {active?.toUpperCase()}
      </Button>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        slotProps={{ paper: { sx: { borderRadius: '16px', minWidth: 180 } } }}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <MenuItem
            key={code}
            selected={code === active}
            onClick={() => choose(code)}
            lang={code}
            sx={{ gap: 1.5 }}
          >
            <ListItemText
              primary={LANGUAGE_LABELS[code]}
              slotProps={{ primary: { sx: { fontWeight: code === active ? 700 : 500 } } }}
            />
            {code === active && (
              <CheckRoundedIcon fontSize="small" color="primary" aria-hidden />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
