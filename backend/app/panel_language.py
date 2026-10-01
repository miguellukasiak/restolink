"""The language of the owner's panel — English, plus at most one more.

Every restaurant's panel speaks English. HQ may give a restaurant one second
language when creating it, and the panel then shows a switch between the two;
the owner's emails and the server's messages follow it.

Polish is written by hand and ships with the app. Every other language in the
menu catalogue can be chosen too: the first time HQ picks one, the panel is
translated into it by DeepL from the English (routers/panel_locales.py) and
kept in `panel_locale`, so each language is translated once for every
restaurant that uses it. Right-to-left languages are left out until the
panel's layout can mirror.

Kept free of imports beyond the catalogue, which itself has none.
"""

from .menu_languages import MENU_LANGUAGES

#: The one every panel has and every request falls back to.
DEFAULT_PANEL_LANGUAGE = "en"

#: Written by hand: the frontend's src/i18n/panel/<code>.json, the emails in
#: email_service.py, the messages as raised. tests/test_panel_language.py
#: checks each one is complete.
BUILT_IN_PANEL_LANGUAGES: tuple[str, ...] = ("pl",)

#: The panel lays out left to right; these need a mirrored layout first.
RIGHT_TO_LEFT: tuple[str, ...] = ("ar", "he")

#: Every language HQ can give a restaurant: the hand-written ones first, then
#: the catalogue's, which DeepL translates on first use.
PANEL_LANGUAGES: tuple[str, ...] = BUILT_IN_PANEL_LANGUAGES + tuple(
    code
    for code in MENU_LANGUAGES
    if code not in (DEFAULT_PANEL_LANGUAGE, *BUILT_IN_PANEL_LANGUAGES, *RIGHT_TO_LEFT)
)


def request_language(accept_language: str | None) -> str:
    """The panel language a request asks for, from its Accept-Language header.

    Only the first tag counts and only its language part: the panel sends a
    single code it chose itself, and anything else is treated as English.
    """
    if not accept_language:
        return DEFAULT_PANEL_LANGUAGE
    code = accept_language.split(",")[0].split(";")[0].strip().split("-")[0].lower()
    return code if code in PANEL_LANGUAGES else DEFAULT_PANEL_LANGUAGE
