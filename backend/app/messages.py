"""Server messages in the language of the panel that asked.

Every message a person may read is written in Polish at the point it is
raised — that is where its meaning is clearest, and the HQ panel reads them as
they are. The owner panel is English by default, so a request that asks for
English (see panel_language.request_language) gets each message swapped here
for its English version, by exact text. A message missing from the table goes
out in Polish rather than blank; tests/test_panel_language.py fails if one is
raised that is not here.
"""

import re

from .panel_language import DEFAULT_PANEL_LANGUAGE

ENGLISH: dict[str, str] = {
    # Sessions and access
    "Wymagane zalogowanie.": "Please sign in.",
    "Hasło zostało zmienione. Zaloguj się ponownie.": (
        "Your password was changed. Please sign in again."
    ),
    "Konto restauracji jest zablokowane.": "This restaurant account is blocked.",
    "Konto restauracji jest zablokowane. Skontaktuj się z nami.": (
        "This restaurant account is blocked. Please contact us."
    ),
    "Nie znaleziono restauracji.": "Restaurant not found.",
    "Nie znaleziono restauracji o podanym ID.": "No restaurant with this ID.",
    "Brak uprawnień administracyjnych.": "You do not have admin rights.",
    "Sesja wygasła. Zaloguj się ponownie.": "Your session has expired. Please sign in again.",
    "Nieprawidłowy token sesji.": "Invalid session. Please sign in again.",
    "Token nie uprawnia do tego zasobu.": "This session cannot open this page.",
    "Nieprawidłowy e-mail lub hasło.": "Incorrect email or password.",
    "Link wygasł lub został już użyty. Poproś o nowy.": (
        "This link has expired or was already used. Ask for a new one."
    ),
    "Link aktywacyjny wygasł lub został już użyty. Poproś nas o nowy.": (
        "This activation link has expired or was already used. Ask us for a new one."
    ),
    "Ten adres e-mail jest już używany przez inne konto. Skontaktuj się z nami, "
    "żebyśmy przypisali inny.": (
        "This email address is already used by another account. Contact us and we "
        "will assign a different one."
    ),
    "Jeśli konto o tym adresie istnieje, wysłaliśmy na nie link do zmiany hasła.": (
        "If an account with this address exists, we have sent it a link to reset "
        "the password."
    ),
    # Menu
    "Nie znaleziono kategorii.": "Category not found.",
    "Nie znaleziono dania.": "Dish not found.",
    "Nie udało się przesłać zdjęcia. Spróbuj ponownie.": (
        "The photo could not be uploaded. Please try again."
    ),
    "Kategoria występuje w układzie więcej niż raz.": (
        "A category appears in the layout more than once."
    ),
    "Danie występuje w układzie więcej niż raz.": "A dish appears in the layout more than once.",
    # Payments
    "Płatności nie są jeszcze skonfigurowane na serwerze.": (
        "Payments are not set up on the server yet."
    ),
    "Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę.": (
        "The payment page could not be opened. Please try again in a moment."
    ),
    # Translations
    "Nie można tłumaczyć menu na jego własny język.": (
        "A menu cannot be translated into its own language."
    ),
    "Automatyczne tłumaczenie nie jest skonfigurowane (brak klucza DEEPL_API_KEY). "
    "Tłumaczenia można wpisać ręcznie.": (
        "Automatic translation is not set up (DEEPL_API_KEY is missing). You can "
        "still type translations by hand."
    ),
    "Klucz DeepL został odrzucony. Sprawdź konfigurację serwera.": (
        "DeepL rejected the API key. Check the server configuration."
    ),
    "Wyczerpano miesięczny limit tłumaczeń DeepL. Tłumaczenia można wpisać ręcznie.": (
        "The monthly DeepL translation limit is used up. You can still type "
        "translations by hand."
    ),
    "DeepL chwilowo odrzuca żądania. Spróbuj ponownie za chwilę.": (
        "DeepL is refusing requests right now. Please try again in a moment."
    ),
    "DeepL nie podpowiada jeszcze tłumaczeń w tym języku. Tłumaczenia można wpisać "
    "ręcznie.": (
        "DeepL does not suggest translations in this language yet. You can type "
        "them by hand."
    ),
    "Nie udało się pobrać tłumaczeń. Spróbuj ponownie za chwilę.": (
        "Translations could not be fetched. Please try again in a moment."
    ),
    # Google reviews
    "To wygląda na adres z Google Maps, a nie na Place ID. Place ID to krótki "
    "identyfikator (np. ChIJN1t_tDeuEmsRUsoyG83frY4) — znajdziesz go w "
    "wyszukiwarce Place ID Finder.": (
        "This looks like a Google Maps address, not a Place ID. A Place ID is a "
        "short identifier (e.g. ChIJN1t_tDeuEmsRUsoyG83frY4) — find it with the "
        "Place ID Finder."
    ),
    "Place ID nie zawiera spacji — sprawdź, czy nie zostało skopiowane coś więcej "
    "niż sam identyfikator.": (
        "A Place ID has no spaces — check that nothing but the identifier was copied."
    ),
    "Klucz API Google Maps nie został skonfigurowany na serwerze": (
        "The Google Maps API key is not set up on the server"
    ),
    "Google nie rozpoznaje tego Place ID. Sprawdź identyfikator w wyszukiwarce "
    "Place ID Finder i zapisz go ponownie.": (
        "Google does not recognise this Place ID. Check it with the Place ID Finder "
        "and save it again."
    ),
    "Google odrzuciło klucz API. Sprawdź konfigurację serwera (GOOGLE_MAPS_API_KEY "
    "oraz włączone Places API (New)).": (
        "Google rejected the API key. Check the server configuration "
        "(GOOGLE_MAPS_API_KEY and that Places API (New) is enabled)."
    ),
    "Wyczerpano limit zapytań do Google Maps. Spróbuj ponownie później.": (
        "The Google Maps request limit is used up. Please try again later."
    ),
    "Google Maps chwilowo nie odpowiada. Spróbuj ponownie za chwilę.": (
        "Google Maps is not responding right now. Please try again in a moment."
    ),
    "Nie udało się połączyć z Google Maps. Spróbuj ponownie za chwilę.": (
        "Could not connect to Google Maps. Please try again in a moment."
    ),
    "Google Maps zwróciło nieczytelną odpowiedź. Spróbuj ponownie za chwilę.": (
        "Google Maps sent an unreadable answer. Please try again in a moment."
    ),
    # HQ actions — the HQ panel asks for Polish, but a message is never left
    # untranslated on the chance that it does not.
    "Nie przekazano żadnych zmian.": "No changes were sent.",
    "Nie znaleziono pakietu.": "Package not found.",
    "Nie znaleziono konta.": "Account not found.",
    "Konto o tym adresie e-mail już istnieje.": "An account with this email already exists.",
    "Nie można odebrać uprawnień samemu sobie. Poproś innego administratora.": (
        "You cannot revoke your own rights. Ask another administrator."
    ),
    "Nie udało się wysłać wiadomości. Sprawdź adres e-mail albo skopiuj link "
    "aktywacyjny i przekaż go inną drogą.": (
        "The message could not be sent. Check the email address, or copy the "
        "activation link and pass it on another way."
    ),
    # Landing-page contact form
    "Wysłano zbyt wiele wiadomości. Spróbuj ponownie później.": (
        "Too many messages were sent. Please try again later."
    ),
    "Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.": (
        "The message could not be sent. Please try again in a moment."
    ),
}

#: Messages with a value in them: (Polish pattern, English template).
_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^Nieobsługiwany język: (.*)\.$"), "Unsupported language: {0}."),
    (
        re.compile(r"^Nieobsługiwany język\. Dostępne: (.*)$"),
        "Unsupported language. Available: {0}",
    ),
    (
        re.compile(r"^Nieobsługiwany język panelu\. Dostępne: (.*)$"),
        "Unsupported panel language. Available: {0}",
    ),
    (
        re.compile(r"^Formularz kontaktowy jest chwilowo niedostępny (.*)$"),
        "The contact form is unavailable right now {0}",
    ),
    (
        re.compile(r"^Najwyżej (\d+) pozycji na danie\.$"),
        "At most {0} per dish.",
    ),
    (
        re.compile(r"^„(.*)” jest za długie — najwyżej (\d+) znaków\.$"),
        "“{0}” is too long — at most {1} characters.",
    ),
]


def localize(message: str, language: str) -> str:
    """`message` in `language` — English swapped in, anything else as written."""
    if language != DEFAULT_PANEL_LANGUAGE:
        return message
    if message in ENGLISH:
        return ENGLISH[message]
    for pattern, template in _PATTERNS:
        match = pattern.match(message)
        if match:
            return template.format(*match.groups())
    return message
