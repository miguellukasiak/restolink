"""The language of the owner's panel — English, plus at most one more.

Every restaurant's panel speaks English. HQ may give a restaurant one second
language when creating it — Polish for a restaurant in Poland — and the panel
then shows a switch between the two. One extra language per restaurant keeps
the promise small enough to keep: each language here needs the whole panel,
the emails and the server's messages translated.

Adding one is a locale file in the frontend (src/i18n/panel/<code>.json), its
emails in email_service.py and its messages in messages.py;
tests/test_panel_language.py checks they exist. Kept free of imports.
"""

#: The one every panel has and every request falls back to.
DEFAULT_PANEL_LANGUAGE = "en"

#: Languages HQ can give a restaurant as its second panel language.
PANEL_LANGUAGES: tuple[str, ...] = ("pl",)


def request_language(accept_language: str | None) -> str:
    """The panel language a request asks for, from its Accept-Language header.

    Only the first tag counts and only its language part: the panel sends a
    single code it chose itself, and anything else is treated as English.
    """
    if not accept_language:
        return DEFAULT_PANEL_LANGUAGE
    code = accept_language.split(",")[0].split(";")[0].strip().split("-")[0].lower()
    return code if code in PANEL_LANGUAGES else DEFAULT_PANEL_LANGUAGE
