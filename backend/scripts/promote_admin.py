"""Grant, create or revoke HQ access for one person.

    cd backend
    python scripts/promote_admin.py you@example.com            # create or promote
    python scripts/promote_admin.py them@example.com --demote  # revoke

The `admin_user` table has no sign-up screen and starts empty, so this is the
only way in: until it has created the first account, nobody can reach the HQ
panel at all. That is deliberate — an HQ account is granted by someone with
database access, never requested through a form.

The password is prompted for rather than passed as an argument. Arguments are
visible in shell history and to anything reading the process list, which for a
credential that opens every customer's data is not a risk worth taking to save
one interactive step.

Needs `DATABASE_URL` in the environment, the same one the API uses.
"""

import argparse
import asyncio
import getpass
import sys
from datetime import datetime, timezone
from pathlib import Path

# Run as `python scripts/promote_admin.py`, so the package root has to be on
# the path before `app` can be imported.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.exc import ProgrammingError  # noqa: E402

from app.database import AsyncSessionLocal, engine  # noqa: E402
from app.models import AdminUser  # noqa: E402
from app.security import (  # noqa: E402
    MAX_PASSWORD_BYTES,
    hash_password,
    password_too_long,
)

MIN_PASSWORD_LENGTH = 8


def _read_new_password() -> str:
    """Prompt twice, refuse anything the API itself would refuse.

    The bounds match `schemas._password_field`. The upper one is not cosmetic:
    bcrypt hashes the first 72 bytes and silently drops the rest, so a longer
    password would not be the password its owner believes it is.
    """
    while True:
        password = getpass.getpass("Nowe hasło: ")
        if len(password) < MIN_PASSWORD_LENGTH:
            print(f"  Hasło musi mieć co najmniej {MIN_PASSWORD_LENGTH} znaków.")
            continue
        if password_too_long(password):
            print(f"  Hasło może mieć najwyżej {MAX_PASSWORD_BYTES} bajtów.")
            continue
        if password != getpass.getpass("Powtórz hasło: "):
            print("  Hasła nie są identyczne.")
            continue
        return password


async def _run(email: str, demote: bool) -> int:
    email = email.strip().lower()

    async with AsyncSessionLocal() as db:
        try:
            admin = (
                await db.scalars(
                    select(AdminUser).where(func.lower(AdminUser.email) == email)
                )
            ).first()
        except ProgrammingError:
            print(
                "Tabela `admin_user` nie istnieje. Uruchom migrację "
                "`migrations/007_admin_users_rbac.sql` albo wystartuj API raz, "
                "aby ją utworzyło.",
                file=sys.stderr,
            )
            return 2

        if demote:
            if admin is None:
                print(f"Brak konta {email} — nie ma czego odbierać.", file=sys.stderr)
                return 1
            if not admin.is_superadmin:
                print(f"{email} i tak nie ma uprawnień administracyjnych.")
                return 0
            admin.is_superadmin = False
            await db.commit()
            print(f"Odebrano uprawnienia administracyjne: {email}")
            # The row stays, so it is still on record who this was. Their
            # existing token dies on the next request, because the flag is
            # re-read from the database rather than trusted from the token.
            return 0

        if admin is None:
            print(f"Konto {email} nie istnieje — zakładam nowe.")
            password = _read_new_password()
            admin = AdminUser(
                email=email,
                hashed_password=hash_password(password),
                is_superadmin=True,
                # Stamped at creation so the column is never NULL for an
                # account that has one; nothing depends on it yet, since no
                # token can predate the row.
                password_changed_at=datetime.now(timezone.utc),
            )
            db.add(admin)
            await db.commit()
            print(f"Utworzono konto administratora: {email}")
            return 0

        if admin.is_superadmin:
            print(f"{email} już ma uprawnienia administracyjne.")
            return 0

        admin.is_superadmin = True
        await db.commit()
        print(f"Nadano uprawnienia administracyjne: {email}")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Nadaje, tworzy lub odbiera dostęp do panelu HQ."
    )
    parser.add_argument("email", help="Adres e-mail konta administracyjnego.")
    parser.add_argument(
        "--demote",
        action="store_true",
        help="Odbiera uprawnienia zamiast je nadawać (konto zostaje).",
    )
    args = parser.parse_args()

    if "@" not in args.email:
        parser.error("To nie wygląda na adres e-mail.")

    try:
        return asyncio.run(_main(args.email, args.demote))
    except KeyboardInterrupt:
        print("\nPrzerwano.", file=sys.stderr)
        return 130


async def _main(email: str, demote: bool) -> int:
    try:
        return await _run(email, demote)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
