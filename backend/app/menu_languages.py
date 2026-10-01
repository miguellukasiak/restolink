"""Which languages a menu can be offered in.

Kept free of imports so the model, the translation service and the routers can
all read it without a cycle.

Every code in `MENU_LANGUAGES` needs three things to be a real choice:

- a DeepL target in `routers/dictionary.py`, so the owner gets drafts;
- a guest-interface locale in the frontend (`src/i18n/locales/<code>.json`),
  so the menu's buttons, allergens and tags read in that language too;
- an entry in the frontend catalogue (`src/constants/menuLanguages.ts`).

`tests/test_languages.py` checks that all of them agree.
"""

#: The catalogue an owner picks from in "Języki", in the panel's order. Large
#: enough to honour the landing page's "unlimited languages" in any sense a
#: restaurant cares about, and small enough that each one has a hand-written
#: guest interface rather than a machine-translated one. A menu can be written
#: in any of them (`restaurant.base_language`) and offered in the others —
#: Polish included, for a restaurant abroad with Polish guests.
MENU_LANGUAGES: tuple[str, ...] = (
    "en",
    "de",
    "uk",
    "fr",
    "es",
    "it",
    "pt",
    "nl",
    "cs",
    "sk",
    "pl",
    "ru",
    "lt",
    "lv",
    "et",
    "hu",
    "ro",
    "bg",
    "el",
    "sl",
    "hr",
    "sv",
    "nb",
    "da",
    "fi",
    "tr",
    "he",
    "ar",
    "zh",
    "ja",
    "ko",
    "vi",
    "hi",
    "id",
    "th",
)

#: What a restaurant from before languages were a choice keeps offering: the
#: four its guest menu always listed. Stored as NULL, so it stays distinguishable
#: from an owner who picked exactly these.
LEGACY_MENU_LANGUAGES: tuple[str, ...] = ("en", "de", "fr", "es")

#: What a new restaurant starts with. English alone: it is what most foreign
#: guests read, and every further language is the owner's decision.
DEFAULT_MENU_LANGUAGES: tuple[str, ...] = ("en",)


def offered_languages(stored: list[str] | None, base_language: str) -> list[str]:
    """The languages a restaurant offers besides its own, in the owner's order.

    Unknown codes are dropped rather than trusted — a code retired from the
    catalogue must not reach a guest — and so is the base language, which is
    not a translation.
    """
    codes = LEGACY_MENU_LANGUAGES if stored is None else stored
    seen: list[str] = []
    for code in codes:
        if code in MENU_LANGUAGES and code != base_language and code not in seen:
            seen.append(code)
    return seen
