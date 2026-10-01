"""DeepL, shared by the two things that use it.

The menu dictionary asks it for *drafts* the owner reviews before any guest
sees them (routers/dictionary.py). The owner panel asks it to translate the
panel's own interface into a language nobody on the team writes by hand
(routers/panel_locales.py) — interface text, not a menu, where a slightly
stiff phrasing costs nothing and a missing language costs a customer.

The key is read lazily, and a missing or refused one is an error naming the
variable (CLAUDE.md §2.2); every DeepL failure maps to a message that says
whose problem it is.
"""

import html
import logging
import os
import re

from fastapi import HTTPException, status

from .translation_service import DICTIONARY_LANGUAGES

logger = logging.getLogger(__name__)

#: Where DeepL's target code is not simply ours in upper case. It refuses a
#: bare "EN" and "PT" — the caller, not the engine, decides which variant — so:
#: British English and European Portuguese, because the guests this exists for
#: are travellers in Europe; Chinese in simplified characters, what visitors
#: from mainland China read; Norwegian as Bokmål, the written standard.
DEEPL_VARIANTS = {"en": "EN-GB", "pt": "PT-PT", "zh": "ZH-HANS", "nb": "NB"}

#: Every catalogue language's DeepL target.
DEEPL_TARGET = {
    code: DEEPL_VARIANTS.get(code, code.upper()) for code in DICTIONARY_LANGUAGES
}


def deepl_key() -> str:
    """The API key, or a 500 that says exactly what is missing.

    A configuration gap, not a user error — hence 500 rather than 4xx, and a
    message the owner can forward to whoever administers the deployment instead
    of a bare "translation failed".
    """
    key = os.getenv("DEEPL_API_KEY", "").strip()
    if not key:
        logger.error("DEEPL_API_KEY is not set — auto-translate is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Automatyczne tłumaczenie nie jest skonfigurowane "
                "(brak klucza DEEPL_API_KEY). Tłumaczenia można wpisać ręcznie."
            ),
        )
    return key


def translation_failure(exc: Exception) -> HTTPException:
    """Turn a DeepL error into a message that says what to do about it.

    The distinction that matters is whose problem it is: a bad key or an empty
    quota is ours to fix and reads as 500, while the API being unreachable or
    busy is upstream's and reads as 502. Either way the owner keeps their typed
    translations — this endpoint never saves, so a failure costs them nothing
    but the drafts.
    """
    import deepl

    if isinstance(exc, deepl.AuthorizationException):
        logger.error("DeepL rejected the API key.")
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Klucz DeepL został odrzucony. Sprawdź konfigurację serwera.",
        )

    if isinstance(exc, deepl.QuotaExceededException):
        logger.error("DeepL translation quota exhausted.")
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Wyczerpano miesięczny limit tłumaczeń DeepL. "
                "Tłumaczenia można wpisać ręcznie."
            ),
        )

    if isinstance(exc, deepl.TooManyRequestsException):
        logger.warning("DeepL rate-limited the request.")
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DeepL chwilowo odrzuca żądania. Spróbuj ponownie za chwilę.",
        )

    # DeepL's language list grows and its plans differ; a target our key cannot
    # use is a 400 naming `target_lang`. The owner can still type translations,
    # so say that rather than a generic failure.
    if isinstance(exc, deepl.DeepLException) and "target_lang" in str(exc):
        logger.warning("DeepL refused the target language: %s", exc)
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "DeepL nie podpowiada jeszcze tłumaczeń w tym języku. "
                "Tłumaczenia można wpisać ręcznie."
            ),
        )

    logger.exception("DeepL translation failed")
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Nie udało się pobrać tłumaczeń. Spróbuj ponownie za chwilę.",
    )


# --------------------------------------------------------------------------- #
# Interface text: the owner panel, its emails and its server messages
# --------------------------------------------------------------------------- #

#: "{{name}}" (the panel's i18next placeholders) and "{name}" / "{0}" (Python
#: format fields in emails and server messages). DeepL must hand them back
#: untouched, so each is wrapped in a tag it is told to leave alone.
_PLACEHOLDER = re.compile(r"\{\{\s*\w+\s*\}\}|\{\w*\}")

#: Steers word choice: "menu" as a restaurant's menu, "dish" not "court", the
#: informal "you" the Polish panel uses. Not translated, not billed.
UI_CONTEXT = (
    "User interface of RestoLink, a web app where restaurant owners build the "
    "digital menu guests open by scanning a QR code: dishes, categories, "
    "prices, allergens, menu design, QR codes, translations. Short button "
    "labels, headings and friendly one-line hints addressed to the owner."
)


def protect(text: str) -> str:
    """Escapes the text for DeepL's XML mode and fences its placeholders."""
    escaped = html.escape(text, quote=False)
    return _PLACEHOLDER.sub(lambda match: f"<x>{match.group(0)}</x>", escaped)


def restore(text: str) -> str:
    return html.unescape(text.replace("<x>", "").replace("</x>", ""))


def translate_interface(texts: list[str], target_lang: str, auth_key: str) -> list[str]:
    """English interface strings in `target_lang`, placeholders intact.

    Blocking, so callers run it in a thread. The informal "you" where the
    language has one, as the Polish panel speaks.
    """
    import deepl

    translator = deepl.Translator(auth_key)
    results = translator.translate_text(
        [protect(text) for text in texts],
        target_lang=target_lang,
        source_lang="EN",
        tag_handling="xml",
        ignore_tags=["x"],
        formality="prefer_less",
        preserve_formatting=True,
        context=UI_CONTEXT,
    )
    if not isinstance(results, list):
        results = [results]
    return [restore(result.text) for result in results]
