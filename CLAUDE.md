# RestoLink — agent handbook

RestoLink is a SaaS for digital restaurant menus: a guest scans a QR code and
gets the menu in their browser. Three deployables live in this repository.

| Path            | What it is                                   | Deployed to |
| --------------- | -------------------------------------------- | ----------- |
| `backend/`      | FastAPI API, Docker image                    | Render service `restolink` — `https://restolink.onrender.com` |
| `frontend/`     | React SPA — owner panel, HQ panel, public menu | Vercel project `restolink` |
| `landing-page/` | Standalone static marketing site             | Vercel project `restolink-landing` |

No infrastructure-as-code lives in the repo; Render and Vercel are configured in
their own dashboards. The two Vercel projects point at the same repository with
different **Root Directory** settings (`frontend`, `landing-page`). Each deploys
`main` to production on every push and builds a preview for every other branch,
and each has **its own environment variables** — `VITE_API_URL` on `restolink`
does nothing for `restolink-landing`. The landing page is served at
`https://restolink-landing.vercel.app`. `.claude/launch.json` defines the
dev-server entry the Browser pane uses.

> This file is written in English to match every docstring and comment in the
> codebase. The HQ panel and the guest menu's base content are **Polish**; the
> owner panel is **English by default** with Polish (and later others) as a
> translation — see "Owner panel language" in §9. API messages are written in
> Polish where they are raised and swapped to English per request.

---

## 1. Stack

**Backend** — Python 3.12 in production (`backend/Dockerfile`), FastAPI,
SQLAlchemy 2.0 async with `asyncpg`, Pydantic v2. Postgres is hosted on **Neon**.
`passlib[bcrypt]` + `pyjwt` for auth, `httpx` for outbound calls, `stripe`,
`resend`, `deepl`, `cloudinary`.

**Frontend** — React 19 + TypeScript (strict) + Vite 8, **MUI v9** (Material
Design 3) with emotion, `@mui/x-data-grid` for tables, TanStack Query v5 for all
server state, `react-router-dom` v7, `react-hook-form` + `zod`, `react-i18next`,
`@hello-pangea/dnd`, `react-scroll`, `date-fns`, `qrcode-generator` + `jsqr` (QR
studio). `vitest` for unit tests (`npm test`); `d3-geo` is a dev dependency used
only by `scripts/build-world-map.mjs`.

**Landing page** — Vite vanilla TS + **Tailwind v4** (`@tailwindcss/vite`, tokens
declared in `@theme` inside `src/style.css`; there is deliberately **no**
`tailwind.config.js`). i18next for en/pl/de/fr/es. Static output, with one
runtime call: the contact form posts to the API, so the build **requires**
`VITE_API_URL` and refuses to run without it.

Tailwind exists **only** in `landing-page/`. The React app is MUI-only — do not
introduce Tailwind there.

---

## 2. Rules that are not negotiable

### 2.1 There is no Alembic. Migrations are hand-written SQL.

The schema is created by `Base.metadata.create_all()` in the FastAPI lifespan
(`backend/app/main.py`). Every schema change also ships as a numbered file in
`backend/migrations/`, applied by hand:

```bash
psql "$DATABASE_URL" -f backend/migrations/00N_name.sql
```

**`create_all` creates missing _tables_. It never alters an existing one.**
So a new **table** is optional-but-provided in a migration, while a new
**column** or **index** is REQUIRED before the deploy lands — otherwise every
query touching that table fails with `UndefinedColumn` and takes the public menu
down with it. This has happened; see §11.

Every migration must be idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT
EXISTS`) and must state at the top whether it is required or optional.

Do not introduce Alembic without being asked. Adopting it now means stamping a
baseline revision against a production database whose schema it never authored.

| File                              | Adds                                                | Status |
| --------------------------------- | --------------------------------------------------- | ------ |
| `001_add_auth_columns.sql`        | `restaurant.email`, `hashed_password`               | required |
| `002_backfill_login_emails.sql`   | backfill helper                                     | optional |
| `003_add_password_changed_at.sql` | `restaurant.password_changed_at`                    | required |
| `004_add_translation_cache.sql`   | obsolete table from a retired MT worker             | dead |
| `005_owner_translation_dictionary.sql` | `restaurant.base_language` + `translation_dictionary` | **column required** |
| `006_add_google_reviews.sql`      | `restaurant.google_place_id` + `google_review_cache` | **column required** |
| `007_admin_users_rbac.sql`        | `admin_user`                                        | optional (table only) |
| `008_audit_log.sql`               | `audit_log`                                         | optional (table only) |
| `009_stripe_billing.sql`          | `restaurant.stripe_customer_id` + unique index on `payment_history.external_transaction_id` | **required** |
| `010_add_menu_pattern.sql`        | `restaurant.menu_pattern`                           | **required** |
| `011_add_menu_languages.sql`      | `restaurant.menu_languages`                         | **required** |
| `012_add_panel_language.sql`      | `restaurant.panel_language` (existing rows get `pl`) | **required** |
| `013_add_menu_notes.sql`          | `menu_note`                                         | optional (table only) |
| `014_add_menu_note_style.sql`     | `menu_note.style` (JSONB, existing rows get `{}`)   | **required** |

### 2.2 Configuration comes only from the environment

Never hardcode a key, secret, URL or price id. Services read `os.getenv`
**lazily inside a function**, not at import time, so a late-configured
deployment and a test behave alike (`stripe_service._env`,
`google_maps._google_key`). A missing key produces a clean HTTP error naming the
variable — never a silent fallback, and never a hardcoded default for anything
that grants access.

`JWT_SECRET_KEY` is the one exception worth understanding: when unset the app
generates an **ephemeral** key for that process rather than using a constant,
because a hardcoded signing key would be a publicly known way to mint admin
tokens.

### 2.3 Never confirm whether an account exists

Login answers identically for an unknown email and a wrong password.
`forgot-password` answers identically whether or not the address is registered,
including when Resend fails. `verify_password` runs a real bcrypt comparison
against a dummy hash when there is no account, so timing matches too.

The one sanctioned exception: at the HQ door, credentials that are **correct**
but lack admin rights get an explicit 403. The caller already proved they own
the account, so nothing is disclosed.

### 2.4 Soft deletes — but not for credentials

Most tables carry `deleted_at` and every query must filter on it. Credentials
are different: `password_reset` rows are **hard-deleted** when spent, and
`audit_log` is append-only. A soft-deleted credential is still a credential.

### 2.5 Money and access changes get audited

Anything that grants access, moves money, or changes who can do either writes an
`audit_log` entry in the **same transaction** as the action.

---

## 3. Data model (`backend/app/models.py`)

```
subscription_package
restaurant ─┬─ menu_category ── menu_item
            ├─ menu_note               (text between the categories)
            ├─ payment_history
            ├─ password_reset          (activation + reset grants)
            ├─ translation_dictionary
            └─ google_review_cache
admin_user                            (HQ staff — NOT restaurants)
audit_log                             (append-only, no FKs)
```

`Restaurant` is both the tenant and the owner's identity. Note the deliberate
split between **`contact_email`** (public-facing contact data) and **`email`**
(the login identity). `email` is `NULL` until the owner activates.

`admin_user` is a separate table on purpose. `Restaurant` requires a name, a
phone and a `package_id` FK, so making an HQ employee one would mean inventing a
fake restaurant and a fake subscription per member of staff. Staff are not
customers.

---

## 4. Auth — two independent session scopes

Two logins, two token roles, two storage keys. They never mix.

| | Owner | HQ admin |
| --- | --- | --- |
| Table | `restaurant` | `admin_user` |
| Endpoint | `POST /api/v1/auth/login` | `POST /api/v1/auth/admin/login` |
| JWT `role` | `restaurant` | `admin` |
| TTL | 7 days | 12 hours |
| Dependency | `get_current_restaurant` | `get_current_superadmin` |
| localStorage | `restolink.auth.restaurant` | `restolink.auth.admin` |

JWT is HS256 with `algorithms=[ALGORITHM]` pinned on decode — accepting a
caller-influenced list is how `alg: none` and HMAC/RSA confusion get in. The
role is checked inside `decode_access_token`, so an owner token can never be
replayed on an admin route.

### Row is re-read on every request

Neither dependency trusts the token's claims beyond the subject. Both load the
row, so blocking, deleting or demoting takes effect on the target's **next
request** rather than whenever their token happens to expire. `is_superadmin` is
deliberately **not** a JWT claim for exactly this reason.

### Password changes end other sessions

`token_predates_password_change(iat, password_changed_at)` refuses tokens minted
before the credential they prove. Compared against the *floor* of the change
timestamp, because `iat` has whole-second resolution and rounding the other way
would sign out the person who just set the new password.

### bcrypt bounds

bcrypt hashes the first **72 bytes** and silently drops the rest, which would
make two different long passwords interchangeable. `MAX_PASSWORD_BYTES = 72` is
enforced in schemas, the CLI and the frontend (counting **bytes**, not
characters — Polish letters are two bytes). `bcrypt` is pinned `<4.1` because
passlib 1.7.4 reads `bcrypt.__about__`, removed in 4.1.

### RBAC

`get_current_superadmin` → valid `admin` token **and** `admin_user.is_superadmin`.
401 means "we do not know who you are"; **403** means "we do, and you may not" —
never collapse them, or a signed-in person gets bounced to a login screen that
cannot fix anything. The 403 detail is `Brak uprawnień administracyjnych.` and
the panel shows it verbatim.

Revoking is `is_superadmin = False`, never a delete: the row stays so the audit
trail keeps pointing at a real account. **Self-revocation is refused** — it is
the only move that can empty HQ, since every other revocation leaves the person
performing it.

There is no sign-up for HQ. Bootstrap the first account with the CLI:

```bash
cd backend && python scripts/promote_admin.py you@example.com          # create or promote
python scripts/promote_admin.py them@example.com --demote              # revoke
```

The password is prompted for, never an argument — arguments land in shell
history and in `ps`. `SUPERADMIN_PASSWORD` is **gone**; if it is still set in any
environment, remove it.

### `verify_restaurant_access`

Owner routes are addressed `/{restaurant_id}/…`, so a valid token is only half
the check. This dependency compares the token's restaurant to the path and
answers **404** (not 403) on a mismatch, so a wrong id does not confirm the
restaurant exists. Applied at **router level**, so a route added later cannot
arrive unprotected by someone forgetting to decorate it.

---

## 5. Impersonation (Ghost Login)

`POST /api/v1/admin/impersonate/{restaurant_id}` mints a **real owner token** for
a support session. The server cannot tell it from a genuine sign-in — that is
the point, and also the risk. Three things keep it proportionate:

1. Behind `get_current_superadmin` like every HQ route.
2. **One hour**, not the owner's week. A support session is a phone call; a
   forgotten tab should not still be a key tomorrow (`IMPERSONATION_TOKEN_TTL`).
3. The audit entry is written **before** the token is built, so no path produces
   a token without a row naming who took it.

Frontend: the borrowed token is stored under the restaurant key with
`impersonated: true`, and the **admin session is left untouched** so the way back
to HQ stays open. `ImpersonationBanner` renders a warning strip across the panel
— since the server cannot distinguish the session, the interface must.

---

## 6. Audit log

`backend/app/audit.py` — one `record()` function and a list of action constants.

- Actions are **stable tokens** (`restaurant.impersonated`), never prose. The
  panel translates them, so rewording the UI never orphans old history. Unknown
  tokens render raw in `AuditLogPage` rather than blank.
- `admin_email` is a **copy, not a FK**. The trail must survive the account.
- Written in the caller's transaction: a row exists exactly when the action it
  describes did. A trail claiming a restaurant was created when the request
  rolled back is worse than no entry.
- The Stripe webhook has no human actor; it records `system:stripe-webhook`,
  shaped so it cannot be mistaken for an email.
- `created_at` is stamped **in Python**, not by `func.now()`. See §11.
- Append-only by construction: nothing updates or deletes rows, and
  `AuditLogPage` is read-only with no endpoint behind an edit.

---

## 7. Onboarding (Resend) and the HQ rescue tools

Creating a restaurant in HQ issues an activation grant and emails a branded
welcome link to `contact_email`. **The email never decides whether the account
exists** — a bounce or a Resend outage leaves a real restaurant HQ can rescue
from the same screen.

`POST /api/v1/auth/activate` sets the password **and fills in the login
identity** from `contact_email`, then returns a session so the owner lands
straight in their panel.

> Deriving the login email at *activation* rather than at creation is what makes
> the rescue work. Correcting a mistyped address and re-sending the link also
> corrects the address the owner will sign in with, because it is read at that
> moment and not weeks earlier. Do not move this to creation.

Activation grants reuse the **`password_reset`** table rather than a
near-identical second one: same mechanics (only the SHA-256 hash is stored, spent
by deletion), with `ACTIVATION_TTL = 7 days` instead of the reset's 30 minutes,
because a welcome email may sit in spam over a weekend.

A **blocked** account's link is deliberately *not* burned when activation is
refused — the link is not the problem there, the account is, and spending it
would strip the owner of the one thing that works once HQ unblocks them.

Rescue actions in the HQ restaurants table (per-row overflow menu):

| Action | Endpoint | Note |
| --- | --- | --- |
| Edytuj dane | `PUT /admin/restaurants/{id}` | records a before→after diff; sends nothing |
| Wyślij link aktywacyjny | `POST …/send-activation-link` | fresh token, emails it |
| Kopiuj link aktywacyjny | `POST …/generate-activation-link` | returns the raw URL, sends nothing |

Both link endpoints **void the previous grant**, so pressing "copy" twice
invalidates a URL an operator may already have pasted. The clipboard write falls
back to a dialog showing the link when the browser refuses.

`PUT /admin/restaurants/{id}` does **not** repoint the login `email` of an
already-activated account. Silently moving a live credential from an HQ form is
not something that endpoint should do alone. Known gap: an activated owner who
loses their inbox still signs in with the old address.

---

## 8. Stripe (Checkout + raw webhooks)

`backend/app/stripe_service.py` + `backend/app/routers/billing.py`. Two routers
with opposite trust models:

- `POST /api/v1/subscriptions/create-checkout-session` — authenticated owner.
  The restaurant comes from the **token**, never the body.
- `POST /api/v1/webhooks/stripe` — **unauthenticated by necessity**; Stripe holds
  no token of ours. Its signature check is the whole of its security.

### The raw-body rule

```python
payload = await request.body()          # never a Pydantic model
signature = request.headers.get("stripe-signature")
```

The signature covers the **exact bytes** Stripe sent. Any parse-and-reserialise
round trip changes whitespace and key order, so a Pydantic-bound body would fail
verification for every genuine event. `tests/test_stripe.py` posts indented JSON
with a trailing newline specifically to prove this path.

The SDK verifies the signature; the event is then read from `json.loads(payload)`
— the same bytes that were just verified. In `stripe` v15 the returned `Event` is
a typed object that is no longer a mapping, so reading it directly couples the
module to a library detail for no benefit.

### Attribution

`client_reference_id` carries the restaurant id, and it is written **three ways**:
on the session, in session metadata, and into the subscription's metadata. The
first two reach `checkout.session.completed`; the third survives into the monthly
`invoice.payment_succeeded` events, which carry **no** `client_reference_id` —
that field exists only on a Checkout Session. `restaurant.stripe_customer_id`,
remembered at first checkout, is the final fallback and the only way renewals are
attributable.

### Idempotency

Stripe retries until it gets a 2xx, and one payment arrives twice over
(`checkout.session.completed` and `invoice.payment_succeeded` both describe the
first month). The event id is stored in
`payment_history.external_transaction_id` under a **unique partial index**; the
handler refuses an id it has seen, and the index settles two retries racing in
the same second. Without this, a retry adds another 30 days.

### Status codes the webhook returns

| Situation | Code | Why |
| --- | --- | --- |
| processed / duplicate / ignored / unmatched | **200** | Stripe retries non-2xx for days; a queue of retries for events we will never act on hides the ones that matter |
| bad or missing signature | **400** | final — it will never verify |
| `STRIPE_WEBHOOK_SECRET` unset | **500** | our misconfiguration; the event is real and *should* be retried once fixed |

### Never shorten a subscription

`_next_valid_until` stretches from the later of *now* or the current expiry, so
paying early adds to remaining time. Stripe's own period end wins when it is in
the future, because that is what the card is billed against.

"Clearing the payment lock" in this schema means `status = ACTIVE`; there is no
separate lock column.

### Frontend return trip

Success URL is `…/panel/{id}/menu?checkout=success`. The owner can arrive back
**before** the webhook lands, so `useCheckoutReturn` re-checks a few times over
several seconds and the banner says so while it does. The `checkout` flag is
stripped once read so a refresh does not re-announce an old payment.

---

## 9. Other subsystems

**Images (Cloudinary).** The browser uploads a Base64 data URI; the API swaps it
for a hosted URL before persisting (this removed a 13 MB → 0.45 MB payload
bottleneck). Delivery transformations (`w_600,q_auto,f_auto`) are injected at
**Pydantic serialization** via `HostedImageUrl`, so they can be retuned in one
place with no migration and no re-upload.

**Public menu theming.** `utils/colors.ts` derives text and divider colours from
the restaurant's own background luminance. This is a guardrail: an unreadable
menu must be impossible whatever colours an owner picks. Any new surface on the
public menu must go through it.

**Menu themes.** "Wygląd menu" opens on a gallery of ready themes
(`MENU_THEMES` in `constants/menuStyle.ts`, filtered by venue kind), each
thumbnailed as the restaurant's *own* dishes in that look (`ThemeThumb`). A
theme is only four stored values — `primary_color`, `background_color`,
`font_family`, `menu_pattern` — so themes can be renamed or retuned without
touching saved menus. `font_family` stores a **pairing** key (`FONT_PAIRINGS`):
a heading face with character plus a plain body face, because dish text must
stay readable at 12–14px; old values (`Roboto`, `Montserrat`, `Playfair
Display`) are still valid keys. `menu_pattern` is a slug (validated
`^[a-z0-9-]{1,32}$`) naming SVG artwork owned by the frontend
(`components/public/menuPatterns.ts`), drawn in the primary colour at low
opacity. Whenever a pattern is on, `theme.menuDecor.cards` gives every dish a
solid card, so no name or price is read off a busy background. A new face needs
its `@fontsource` import in `main.tsx` **and** its woff2 in `qrExport.ts`
`FONT_FILES`, because the QR studio sets the restaurant name in the heading face
and embeds it in exports.

**Translation dictionary.** Machine translation was removed twice — free
endpoints refuse Render's shared IPs, and a menu is the one text you cannot get
wrong ("Smażony ser" came back as *boiled* cheese). Owners now maintain
`translation_dictionary` per restaurant; DeepL only drafts proposals the owner
reviews and saves. Fallback chain per phrase: requested language → English →
original.

**Owner panel language.** Every owner panel is **English**. HQ may give a
restaurant one more language (`restaurant.panel_language`, set in the HQ
create/edit forms, "Dodatkowy język panelu"); the panel's app bar then shows a
switch between the two, and the choice is remembered per device
(`restolink.panel.lang`). NULL means English only; migration 012 gave every
existing restaurant `pl`. The panel speaks exactly the languages in
`PANEL_LANGUAGES` — `backend/app/panel_language.py` and `src/i18n/panel.ts`
must list the same codes. Pieces:

- **Strings** live in `src/i18n/panel/<code>.json`, read through `usePanelT()`
  (or `tp()` outside React). It is a **second i18next instance**, deliberately
  not registered with react-i18next, so every `useTranslation()` in the guest
  components still means the guest menu's instance. Guest components shown
  inside the panel (phone previews, the dish preview) are wrapped in
  `GuestPreviewLanguage`, which gives them a private instance in the panel's
  language. Plurals use i18next's `_one/_few/_many/_other` keys; language and
  country names come from `Intl.DisplayNames`, never a hand-kept list.
- **Before sign-in** the auth screens offer every panel language; links in
  emails carry `&lang=<code>` so the page continues in the email's language.
  `/hq-access` has no switch — HQ is Polish only.
- **Server messages** are raised in Polish and localised on the way out
  (`app/messages.py`, applied by the exception handlers in `main.py`) from the
  request's `Accept-Language`, which `services/api.ts` sets: `pl` for HQ
  routes, the panel language for owner routes, nothing for guest routes.
  `tests/test_panel_language.py` fails if a raised message has no English.
- **Emails** (welcome, reset) go out in `panel_language`, else English
  (`EMAIL_COPY` in `email_service.py`).
- What stays Polish whatever the panel's language, because it is the **menu's**
  content, not the panel's: category suggestions and the starter layout, the
  words printed on QR templates, the stored allergen/tag values (the panel
  shows built-ins translated, `usePanelLabels`).

Adding a language (Czech, say): its `src/i18n/panel/<code>.json` with every
key, the code in both `PANEL_LANGUAGES`, its `EMAIL_COPY` block, and — if the
panel shows the guest preview in it — nothing more, the guest locales exist
already. `src/i18n/panel.test.ts` checks key parity, plural forms, placeholders
and that every key the code asks for exists.

**Menu languages ("Języki", `/panel/:id/dictionary`).** A catalogue of 34
languages, `MENU_LANGUAGES` in `backend/app/menu_languages.py` — mirrored by
`constants/menuLanguages.ts` and backed by one guest-interface locale per code
in `src/i18n/locales`; `tests/test_languages.py` fails if the three disagree,
or if a code has no DeepL target. `restaurant.menu_languages` holds what the
owner offers, in order: **NULL means a restaurant from before the choice
existed and keeps the old four (en, de, fr, es)**; new rows start with `["en"]`.
Always read it through `offered_languages()`. The public menu carries
`restaurant.languages` (base first) and the guest switcher lists only those; a
guest whose browser asks for another is moved to English if offered, else
Polish. Locales other than pl/en are **lazy-loaded** (a tiny i18next backend
over `import.meta.glob`), so the app root has a `Suspense` boundary. Right-to-
left text needs no layout flip: the menu theme sets `unicode-bidi: plaintext`
on every Typography, so each paragraph takes its direction from its own text
(verified in Chromium — Arabic aligns right, Polish stays left).

The screen opens on a world map (`components/panel/languages/`): **reach** is
computed per country as `1 − Π(1 − share)` over the offered languages
(`reach.ts`), so a person is counted once however many languages they read,
and adding Swedish after English honestly adds ~2 M, not Sweden. Shares are
rounded estimates written in `COUNTRY_SHARES`; populations and shapes come from
Natural Earth 1:110m v5.1.2 (public domain), pre-projected by
`scripts/build-world-map.mjs` into `worldCountries.json` — regenerate, never
hand-edit. The map uses four coverage steps rather than a gradient (a gradient
tinted half the world at 5–8 % English). A share means who can **read** a
menu in the language, not whose mother tongue it is: a country's official
language counts as read by nearly everyone schooled there (a native-speaker
86 % once had the map promise 93 % of Lithuania after adding Lithuanian). The
hover card speaks in whole sentences with the figures in them — "Teraz Twoje
menu przeczyta tu 49% mieszkańców. Czytają je ci, którzy znają angielski lub
polski. Dodaj litewski, a przeczyta je 98% mieszkańców — o 1,4 mln osób
więcej." — which says what is now, what is after, and why. The owner asked for
percentages over words like "most"; an estimate is shown as at most 99% and
at least "less than 1%", never rounded into a promise. Guidance is deliberate: "Polecane w
Polsce" (tiered, one-line reasons with no invented statistics) comes before
world reach, each candidate shows the *new* readers it adds, the upkeep is
spelled out per new dish, the page warns from `MANY_LANGUAGES` (6) and asks
for confirmation past `CONFIRM_LANGUAGES_OVER` (10). Adding a language that
still needs translating — from the map or the list — scrolls to its
translations and rings them for a moment; a snackbar alone made a new
language look finished while guests still read Polish.

**Google reviews.** `GET /api/v1/panel/{id}/google-reviews`, backed by a
24-hour `google_review_cache`. Uses **Places API (New)**
(`places.googleapis.com/v1`) with the key in `X-Goog-Api-Key` and a
`X-Goog-FieldMask` header — the legacy endpoint is a separate Google Cloud
product and answers `REQUEST_DENIED` if only the new one is enabled. The cache
row stores the `place_id` it describes, so correcting a mistyped id does not keep
serving another restaurant's reviews.

**Allergens and tags on the public menu.** Stored as plain strings. The
**built-in** ones (`ALLERGEN_OPTIONS`, `TAG_OPTIONS`, mirrored by
`BUILT_IN_ALLERGENS` / `BUILT_IN_TAGS` in `backend/app/menu_labels.py`; a test
keeps them equal) are stored as their Polish label and passed through by the
API untranslated; the guest menu translates them with `useMenuLabels()`, which
maps each stored value to a stable i18n key (`allergenFish`, `tagSpicy`, …) via
`getAllergenI18nKey` / `getTagI18nKey`. **Filtering, matching and icons use the
stored value.** Owners can also add **their own** ("Sezam", "Z pieca") in the
dish editor (`ChoiceChips`): typed text is tidied and snapped to a built-in on
a case-insensitive match, labels used on any dish are offered on every other,
and the API bounds them (`MAX_LABEL_LENGTH` 40, `MAX_LABELS` 20 per list). Own
labels are phrases like dish names — `dish_texts()` lists them in the
dictionary, and the public menu serves them translated, consistently across
the payload, so the allergy filter built from it still matches. Built-in
labels are never taken from the dictionary. A new option needs a key in the map and in
every locale file (one per catalogue language, plus Polish).

**Contact form (landing page).** `POST /api/v1/public/contact`
(`routers/contact.py`) emails an inquiry via Resend to `CONTACT_INBOX_EMAIL`,
with **Reply-To set to the visitor** so answering reaches the lead directly.
It is the one public route that sends email, and Resend's quota is shared with
resets and activations, so it carries a honeypot field (`website`, answered with
a fake success and logged in case it was a person), a per-client limit (5/hour, left-most `X-Forwarded-For`) and a
global cap (50/day) that holds when that header is spoofed. Limits are
in-process memory — fine for Render's single instance. **A lead is never
answered with a success unless Resend accepted it**: missing config is a 503
naming the variable, a Resend failure a 502, and both write the whole inquiry to
the log so it can be recovered. Every visitor-typed value is HTML-escaped in the
email. The landing page's own origin must be listed in `CORS_ALLOWED_ORIGINS`.

**Notes between the sections ("Tekst w menu").** Lunch hours, what a set
menu consists of, a word about allergies — text a guest should read that is
not a dish. `menu_note` is its own table rather than a kind of category, so
nothing that lists categories (the dish editor's picker, the guest's category
strip, the readiness count) has to learn to skip it, and the deploy needs no
migration. Its `sort_order` **shares one numbering with the categories'** of
the same restaurant; `menu_layout()` (models.py) and `menuSections()`
(`utils/menuLayout.ts`) merge the two, a category first on a tie. So every
path that places a section counts both: a new category goes after
`_edge_position` over both tables, and `PUT …/menu/order` takes `layout` — all
section ids top to bottom. A body without `layout` comes from a client that
has never seen a note: its categories fill the category slots and the notes
keep theirs. Notes drag among the categories on the board (same `CATEGORY`
droppable), are added at the top from the header ("Nowy tekst") or at the
bottom from the board's foot (the only way on a phone), hide while the guest
searches (not under the allergy filter), keep the owner's line breaks, and are
phrases in the dictionary like dish names — listed where they sit in the menu
and served translated. Starting texts are `NOTE_TEMPLATES` in
`constants/menu.ts`, Polish like the category suggestions, each with an icon.

A note's text carries a small markup — `**bold**`, `*italic*`, a line
starting `# ` (heading, in the theme's heading face) or `- ` (list item) —
parsed by `components/public/noteMarkup.ts` into data and built into elements
by React, **never** set as HTML, so nothing typed can inject markup. It is
plain text in a textarea on purpose: the editor's toolbar and Ctrl+B / Ctrl+I
write the markers, the preview beside it shows the result, and the stored
note stays one phrase the dictionary can hold. `menu_note.style` (JSONB,
validated by `NoteStyle`) holds the look: `icon` (a slug from `NOTE_ICONS`
in `noteIcons.ts`, null for none, an unknown slug drawn as the default — the
frontend owns the artwork, like `menu_pattern`), `variant` (`card` tinted
frame, `filled` brand colour with contrasting text, `plain` text alone) and
`align`. Every field has a default, so `{}` reads as the original look; a new
option is a new field with a default, not a migration.

**Menu builder ("Kreator menu").** One vertical section per category, with
the guest menu on a phone beside it (`LiveMenuPreview`, `lg` and up; a
"Podgląd" dialog below that). The phone renders the real `PublicMenuView`
under the restaurant's theme but is fed the **board's local state**, so a drag
or a switch shows on it before the server answers; clicking a dish in it opens
the editor. Dishes are edited in a centred two-pane dialog
(`MenuItemEditorDialog`) whose right pane is the dish as guests will see it.
Order is saved by `PUT /api/v1/restaurants/{id}/menu/order`, which takes the
**whole board** (not one move) so a late or repeated request still lands on the
layout the owner last saw; ids that are not this restaurant's answer 404, and
live rows the body leaves out keep their order after the listed ones. The dish
upsert likewise proves a body-supplied dish id belongs to the restaurant —
dish ids are public on every guest menu, and without that check one owner
could pull another's dish into their menu.

**QR studio ("Kody QR").** `components/panel/qr/`. Our own SVG renderer
(`qrArt.ts`) on `qrcode-generator`, not a styling library, because:

- The printed code carries a **short link**, `/m/<25-char base-36 id>`, which
  `ShortMenuLink` expands to `/menu/<uuid>` (`utils/menuLink.ts`).
- The link is upper-cased after the scheme and split into two segments:
  `https://` in byte mode, the rest in alphanumeric mode. At error correction
  H (with a logo) that is 41×41 modules instead of 49×49; at Q (without one)
  33×33 instead of 45×45.
- Styling libraries take a single string and cannot express two segments.

Old printed codes pointing at `/menu/<uuid>` keep working. The studio starts
from designs built from the restaurant's own colour, darkened by
`readableOnWhite` until it reaches 4.5:1 contrast. It shows the chosen design
on templates in real millimetres: a table card, a round sticker, a poster,
or the bare code.

Each template has print sizes:

- table card: A7, A6, A5;
- sticker: Ø 5–10 cm;
- poster: A5, A4, A3;
- bare code: 3–10 cm, or a custom size from 2 to 18 cm.

A size scales the whole design. `planSheet` fits as many copies as possible
on an A4 page, in whichever orientation holds more. A poster is its own page
in its own size. The readability check warns when printed modules drop below
0.5 mm.

Every change is **decoded from the rendered pixels with jsQR**. Two rules come
from that test:

- Alignment patterns are drawn whole, never as loose dots. As dots they fail
  to decode in 3 of 4 formats.
- A new dot or eye style must pass the decode test in every format before it
  ships.

Exports:

- **PDF:** an A4 sheet printed through a hidden iframe; the browser's "Save as
  PDF" produces a vector file with the fonts embedded.
- **PNG:** 300 dpi.
- **SVG:** fonts inlined from `@fontsource` as data URIs.

In the print document, style `body>svg`, never `svg` — the codes are nested
`<svg>` elements and a page-sized rule enlarges each one to the whole sheet.

---

## 10. Frontend conventions

- **All server state goes through TanStack Query.** No `useEffect` fetching.
- `services/*.ts` own the HTTP calls and their types; `hooks/*.ts` wrap them in
  queries and mutations; pages compose hooks.
- **Invalidation is declared, not hand-written** (`services/cacheSync.ts`).
  Every owner query states what its answer is built from, `meta: { reads:
  ['menu', 'theme', …] }`; every owner mutation states what it changes,
  `meta: writesTo(restaurantId, ['menu'])`. On success the `MutationCache` in
  `main.tsx` invalidates every cached query of that restaurant that reads it,
  and tells the browser's other tabs over a `BroadcastChannel` (ids and
  resource names only, never data), so the guest menu opened with "Open"
  updates as the owner works. Do not add `invalidateQueries` to a mutation's
  `onSuccess`: before this, a dish edited in the builder never reached "Wygląd
  menu", because each mutation refreshed only the page it lived on. A
  mutation that seeds a query from its own response (the theme patches the
  public menu, the dictionary and languages seed their query) runs first —
  the invalidation is deferred a task — and lists keys it keeps correct
  itself in `writesTo`'s third argument. A new resource goes in `Resource`;
  `cacheSync.test.ts` fails on an owner `useMutation` without `writesTo`.
- **Add every new owner API prefix to `sessionScopeFor` in
  `services/api.ts`.** It matches on prefixes, so a route under a new one
  silently loses its token. This already shipped a 401 once (the dictionary under
  `/panel`). Current owner prefixes: `/api/v1/restaurants`, `/api/v1/panel`,
  `/api/v1/subscriptions`. Admin: `/api/v1/admin`. Unauthenticated: `/auth`,
  `/public`, `/webhooks`.
- The Axios layer retries a **GET** once on a timeout or no-response (Render free
  tier cold starts, 30 s timeout) and never retries writes. A 401 on a protected
  path clears that scope's session and redirects; a 401 from `/auth/*` is the
  normal "wrong password" and must not bounce the page.
- Brand: primary `#0F8256` (the landing page's CTA green, `--color-brand-600`),
  dark `#0C6544`, light `#16A06A`. The wordmark is the `Wordmark` component in
  **Dela Gothic One** — one weight, display only, deliberately not in the body
  font stack. There is no letter-tile logo any more.
- Owner nav order is the setup order: **Menu builder → Menu design → QR codes**
  (Kreator menu → Wygląd menu → Kody QR), then the extras (Languages, Google
  reviews) below a divider.
- Route guards (`RequireAuth.tsx`) are a **convenience, not the boundary** —
  every protected endpoint is enforced server-side.
- **A page that holds unsaved edits mounts `UnsavedChangesGuard`** (Wygląd
  menu, the translations in Języki). Leaving for another panel page, Back
  included, opens a stay / leave / save-and-continue dialog; closing or
  reloading the tab gets the browser's prompt; signing out is not held up. It
  relies on `useBlocker`, so the app runs on a **data router**
  (`createBrowserRouter` in `App.tsx`) — do not go back to `<BrowserRouter>`.
- **Phone previews keep a real phone's proportions.** `PhoneFrame` defaults
  its screen to `PHONE_ASPECT` for its width, and `useFittedPhone` sizes the
  whole device from the window height (browser zoom included). Never squeeze
  the screen height on its own: a fixed 300px frame over `calc(100vh − …)`
  came out stubby at 100% zoom on a laptop. A page with a side preview puts
  its heading in the left column so the preview starts at the top.
- **No hardcoded text in the owner panel.** Every string a restaurant owner
  reads goes through `usePanelT()` with a key in **every**
  `src/i18n/panel/<code>.json`; `src/i18n/panel.test.ts` fails on Polish
  letters in panel code outside its short allowlist (HQ-facing and printed
  guest content). Zod schemas carry keys as their messages, translated where
  shown. The HQ panel stays plain Polish strings.
- **Corner radii come from `radii` in `theme.ts`** (`xs` 8 … `xl` 28, px
  strings). Never a bare number in `sx` — see §11, trap 14. Nested surfaces
  follow outer − padding so the curves stay concentric.

### Routes

```
/                       → /login
/login  /forgot-password  /reset-password  /activate  /hq-access
/admin/{restaurants,team,logs}          (RequireAdminAuth)
/panel/:restaurantId/{menu,qr,dictionary,google,settings}   (RequireRestaurantAuth)
/menu/:restaurantId     public, themed, no account
/m/:code                short link printed in QR codes → /menu/:restaurantId
```

---

## 11. Traps that have actually bitten

Each of these cost real debugging time in this repo. They are not hypothetical.

1. **`create_all` never adds a column.** A model change without a migration
   turns every query on that table into a 500 — including the public menu. Seen
   live twice.
2. **Naive vs aware datetimes.** Postgres returns aware values for `TIMESTAMPTZ`;
   that is a property of the driver, not a contract. Comparing a naive value to
   an aware one raises mid-request and turns a security check or a payment into a
   500. Always route stored timestamps through **`security.as_utc()`**.
3. **A rollback expires every instance in the session**, regardless of
   `expire_on_commit=False`. Touching `obj.id` in an `except` branch triggers a
   lazy reload — synchronous IO in async context — and SQLAlchemy raises
   `MissingGreenlet`, replacing a clean 409 with a 500. **Read ids into locals
   before the commit.**
4. **`noload()` poisons the identity map.** It marks a relationship as
   loaded-and-empty, so a later `selectinload` query returns the same object and
   skips the loader — leaving the relationship `None` and failing
   `response_model` validation. Load what the response needs.
5. **Unit tests bypass `response_model`.** Calling an endpoint function directly
   skips FastAPI's serialization, so a response-shape bug passes the suite and
   500s in the browser. Validate the model explicitly, or go through the ASGI app.
6. **`func.now()` is transaction-scoped on Postgres**, so several rows written in
   one request share a timestamp to the microsecond and any "newest first"
   ordering falls through to a random UUID. SQLite makes it worse — one-second
   resolution. Stamp audit-style timestamps in Python.
7. **Browsers pause CSS animations in a hidden tab, and a paused animation holds
   its first frame indefinitely.** An entrance written `from { opacity: 0 }` with
   no `forwards` fill is *not* safe: measured 40 dish cards behind an invisible,
   blurred page. `useAnimationWindow` removes the animation on a timer so the
   plain, visible rules apply whether it played or not. Unmount overlays on
   **timers, never `animationend`**.
8. **The Browser pane runs hidden** (`visibilityState: "hidden"`). rAF,
   IntersectionObserver, CSS animations and transitions do not run; screenshots
   time out; MUI Select/Menu popovers may not render; and `getComputedStyle` can
   return a **stale** value for an element whose state changed. Verify via
   DOM/`getComputedStyle`, and when a reading looks impossible, measure a fresh
   clone of the element before believing it.
9. **`react-scroll`'s `Element` sets `name`, not `id`.** An IntersectionObserver
   looking for ids finds nothing. Set both.
10. **MUI v9 `Stack` rejects `alignItems` as a prop** — put it in `sx`.
11. **Stripe v15 `Event` is not a mapping.** `dict(event)` raises. Read the event
    from the verified raw bytes.
12. **Loanwords defeat "identical means broken" heuristics.** "Tiramisu" is the
    same in German; a guard that rejected identical translations once caused an
    infinite client poll.
13. **A build-time guard is a deploy-time outage.** When the landing build began
    refusing to run without `VITE_API_URL`, every `restolink-landing` deploy
    failed for over an hour, because the variable existed only on the other
    Vercel project. Whenever a change adds a required build variable, name the
    exact Vercel project it must be set on before the change reaches `main`.
14. **`borderRadius: 3` in `sx` is 42px, not 3px.** A bare number multiplies
    `theme.shape.borderRadius` (14 in the panel, 16 in the menu theme). It
    turned the builder's dish cards into pills around two lines of text and its
    checkbox cards into 56px curves, and the same bug sat in the QR page, the
    logo upload and the subscription banner. Use `radii`.
15. **Viewport breakpoints lie inside a scaled preview.** `{ xs, sm, lg }` in
    `sx` answer to the *window*, so a menu laid out at 390px inside a phone
    mockup on a desktop screen got the four-column desktop grid. The guest
    menu's grid uses container queries on `<main>` for this reason; anything
    rendered inside `PhoneFrame` must size itself from its container too.
16. **`scrollIntoView` scrolls every ancestor, the page included** — `block:
    'nearest'` only limits how far. The public menu is also rendered inside the
    panel's live previews, which sit below the form on a phone; the category
    strip's `scrollIntoView` dragged the whole Appearance page down to the
    preview, and each category the spy then passed dragged it further.
    `CategoryPills` now sets its own `scrollLeft`. Scroll the container you mean.

---

## 12. Environment variables

| Variable | Used by | Missing behaviour |
| --- | --- | --- |
| `DATABASE_URL` | everything | falls back to a local Postgres DSN |
| `JWT_SECRET_KEY` | auth | **ephemeral per-process key**; all sessions die on restart. ≥32 bytes |
| `APP_BASE_URL` | email links, Stripe URLs | defaults to the Vercel domain |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | image upload | loud warning, uploads disabled |
| `RESEND_API_KEY`, `RESEND_FROM` | reset + welcome + contact email | reset/welcome: **not sent**, the link is written to the log instead. Contact form: 503 |
| `CONTACT_INBOX_EMAIL` | landing contact form (comma-separated for several) | **503 naming the variable**; the inquiry is written to the log |
| `CORS_ALLOWED_ORIGINS` | extra CORS origins, comma-separated — the landing page's domain(s) | only the built-in list; the contact form fails in the browser |
| `STRIPE_API_KEY`, `STRIPE_PRICE_ID` | checkout | 503 from the checkout endpoint |
| `STRIPE_WEBHOOK_SECRET` | webhook | **500, refuses to act** — never skips verification |
| `GOOGLE_MAPS_API_KEY` | reviews | 503 naming the variable |
| `DEEPL_API_KEY` | dictionary drafts | 500 naming the variable; manual entry still works |
| `VITE_API_URL` | frontend build | defaults to `http://localhost:8000` |
| `VITE_API_URL` | landing-page build | **build fails** — a form posting to localhost would lose every lead. Set it in the `restolink-landing` Vercel project (Production and Preview) to `https://restolink.onrender.com` — there is no `restolink-backend.onrender.com`, and Render's 404 for an unknown host carries no CORS headers, so a wrong URL surfaces in the browser as a CORS error. `landing-page/.env.example` |

`SUPERADMIN_PASSWORD` is **retired**. Nothing reads it.

---

## 13. Local development

```bash
# backend  (venv bin dir is .venv/bin on Linux, .venv/Scripts on Windows)
cd backend
python -m venv .venv
python -m pip install -r requirements.txt
uvicorn app.main:app --reload            # needs DATABASE_URL

# tests — SQLite, no container, no credentials
pip install -r requirements-dev.txt
pytest

# frontend
cd frontend && npm install && npm run dev
npx tsc --noEmit -p tsconfig.app.json    # run before committing
npm test                                 # vitest: reach model invariants

# the languages map (only when changing its source or projection)
node scripts/build-world-map.mjs
```

`backend/tests/conftest.py` teaches SQLite the two Postgres-only column types
(`JSONB`, `UUID`) with `@compiles`, so the **real models** are used verbatim
rather than mirrored — a mirrored schema is a second source of truth that drifts.
It drops and rebuilds the schema per test and disposes the pool afterwards
(deleting the file fails on Windows while the pool holds it open).

Docker Compose exists in `backend/` but is not required; pointing
`DATABASE_URL` at Neon is the simpler path.

---

## 14. Outstanding backlog

Deployment prerequisites, carried across several sessions:

- [x] **Migrations `005`, `006`, `009`** — required columns. Applied to
      production (confirmed by the owner, 2026-09-28).
- [x] **Migration `010`** (`restaurant.menu_pattern`) — required column.
      Applied to production (confirmed by the owner, 2026-09-29).
- [x] **Migration `011`** (`restaurant.menu_languages`) — required column.
      Applied to production (confirmed by the owner, 2026-09-29).
- [x] **Migration `012`** (`restaurant.panel_language`) — required column.
      Applied to production (confirmed by the owner, 2026-09-29).
- [x] **Migration `014`** (`menu_note.style`) — required column.
      Applied to production (confirmed by the owner, 2026-09-30).
- [ ] `007`, `008` and `013` are table-only and optional (`create_all` covers
      them).
- [ ] **DeepL quota is shared by every restaurant.** Drafting a whole menu into
      one language costs its character count; with 34 languages on offer, a
      free-tier key (500k characters/month) can run dry. Watch usage; the
      endpoint already answers an exhausted quota with a clear message.
- [ ] **Bootstrap the first HQ account** (`scripts/promote_admin.py`, or the
      equivalent SQL insert). Until it exists nobody can reach `/hq-access`.
- [ ] **Remove `SUPERADMIN_PASSWORD`** from the Render environment once a real
      account works. A retired secret left in place gets reused somewhere it
      still opens a door.
- [ ] **Rotate the Cloudinary API secret** — it was pasted into a chat long ago
      and has never been rotated.
- [ ] Register the Stripe webhook endpoint and set its three variables.
- [ ] Restrict `GOOGLE_MAPS_API_KEY` to **Places API (New)** in Google Cloud.
- [ ] **Contact form:** `CONTACT_INBOX_EMAIL` on Render, and
      `CORS_ALLOWED_ORIGINS` including `https://restolink-landing.vercel.app`
      (plus a custom domain — **both** `www.` and apex — once there is one).
      `VITE_API_URL` is set on `restolink-landing` and its builds are green
      again as of 2026-09-28.

Known product gaps, not bugs:

- No way to change an **HQ admin's** password through the app; the reset flow is
  restaurant-only and the CLI does not rotate passwords.
- `PUT /admin/restaurants/{id}` does not repoint an activated owner's login
  email (§7).
- The landing page footer's phone (`+48 000 000 000`) and address
  (`Lorem ipsum 1, 00-000 …`, in every locale) are still placeholders.
- The built-in allergen vocabulary (`ALLERGEN_OPTIONS`) covers 8 of the EU's
  14; peanut, crustacean, mollusc, sesame, sulphite and lupin exist only as an
  owner's own label, translated by hand in "Języki". Making them built-in means
  a key in all 35 guest locales. Because an owner may tick "Orzechy" for
  peanuts, it is translated to the broad everyday word (Nuts / Nüsse / Frutos
  secos) rather than the narrower "tree nuts".
- The public menu's blocked-status screen ("Menu chwilowo niedostępne.") is
  hardcoded Polish.
- The landing page promises **unlimited languages** (hero chip and pricing),
  and deliberately names no number. The catalogue is 34 languages
  (`menu_languages.py`), each with a hand-written guest interface; do not "fix"
  the landing copy back to a count.
- A restaurant outside Poland gets its panel in its language, but the **menu**
  is still Polish-based: the base language is `pl`, prices are in zł, the
  starter categories and printed QR words are Polish, Google reviews are
  fetched in Polish, and "Języki" recommends languages for Poland. Serving
  another country is its own piece of work, separate from the panel language.
- Scroll-spy tuning (`SPY_ROOT_MARGIN` in `useCategoryScrollSpy.ts`) has never
  been verified against real scrolling — the preview pane cannot scroll.
