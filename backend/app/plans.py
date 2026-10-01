"""The plan a restaurant is on.

RestoLink sells one plan — the landing page's single price, every feature
included — so HQ picks nothing when it creates a restaurant: each one is put
on the plan named `DEFAULT_PACKAGE_NAME`, made on first use.

The door stays open for tiers. `subscription_package` and
`restaurant.package_id` are kept, `POST /admin/restaurants` still takes an
explicit `package_id`, `GET /admin/packages` still lists the plans and the
admin restaurant list still carries each one's `package`. Bringing tiers
back is adding their rows, showing a picker in HQ again, and deciding what
each unlocks; nothing reads the plan today.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import SubscriptionPackage

#: The one plan, as stored. Never shown in the panels.
DEFAULT_PACKAGE_NAME = "Standard"


async def default_package(db: AsyncSession) -> SubscriptionPackage:
    """The one plan, made the first time a restaurant needs it.

    The oldest live row of that name wins, so a second one made by two
    restaurants created in the same instant is harmless.
    """
    package = await db.scalar(
        select(SubscriptionPackage)
        .where(
            SubscriptionPackage.name == DEFAULT_PACKAGE_NAME,
            SubscriptionPackage.deleted_at.is_(None),
        )
        .order_by(SubscriptionPackage.created_at.asc())
        .limit(1)
    )
    if package is None:
        package = SubscriptionPackage(name=DEFAULT_PACKAGE_NAME)
        db.add(package)
        await db.flush()
    return package
