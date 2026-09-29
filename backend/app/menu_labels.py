"""Allergens and tags: the vocabulary that ships translated, and the owner's own.

A dish's `allergens` and `tags` are plain strings. The built-in ones below are
stored as their Polish label and translated by the guest interface itself (one
i18n key each, in every locale), so they read correctly in all 34 languages
with no work from the owner. Anything else is the owner's own label — "Sezam",
"Z pieca" — which goes through the owner's dictionary like a dish name: it is
listed in "Języki" for translation and served translated to the guest.

Mirrors ALLERGEN_OPTIONS and TAG_OPTIONS in the frontend's constants/menu.ts;
tests/test_menu_labels.py checks the two agree. Kept free of imports so the
schemas, the translation service and the routers can all read it.
"""

from collections.abc import Iterable

BUILT_IN_ALLERGENS: tuple[str, ...] = (
    "Gluten",
    "Laktoza",
    "Orzechy",
    "Jaja",
    "Soja",
    "Ryby",
    "Seler",
    "Gorczyca",
)

BUILT_IN_TAGS: tuple[str, ...] = (
    "Wegańskie",
    "Wegetariańskie",
    "Bestseller",
    "Pikantne",
    "Nowość",
)

#: Long enough for "Orzeszki ziemne i sezam", short enough to stay a chip.
MAX_LABEL_LENGTH = 40

#: Per dish, per list. A dish with more than this is a paste gone wrong.
MAX_LABELS = 20


def clean_labels(values: Iterable[str], built_in: tuple[str, ...]) -> list[str]:
    """Tidy a dish's labels the way the owner meant them.

    Whitespace trimmed and collapsed; blanks and repeats dropped (case does
    not make a new label); and anything that matches a built-in label in
    another case becomes the built-in one, so "gluten" typed by hand still
    gets the translated, filterable "Gluten" rather than a look-alike.
    """
    canonical = {label.casefold(): label for label in built_in}
    seen: set[str] = set()
    cleaned: list[str] = []
    for raw in values:
        label = " ".join(raw.split())
        if not label:
            continue
        key = label.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(canonical.get(key, label))
    return cleaned


def custom_labels(values: Iterable[str], built_in: tuple[str, ...]) -> list[str]:
    """The labels the owner made up — the ones that need the dictionary."""
    return [value for value in values if value not in built_in]
