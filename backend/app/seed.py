"""Idempotent demo seeding so the frontend has data on a fresh database.

Runs only when the packages table is empty. Creates three packages, a handful
of restaurants across all statuses, and one fully-populated demo menu.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    MenuCategory,
    MenuItem,
    Restaurant,
    RestaurantStatus,
    SubscriptionPackage,
)

_RESTAURANT_NAMES = [
    "Sushi Master",
    "Trattoria Bella",
    "Pierogarnia u Babci",
    "Burger Republic",
    "Zielona Oliwka",
    "Ramen House",
    "Kebab King",
    "Bistro Nadwiślańskie",
]
_STATUSES = [
    RestaurantStatus.ACTIVE,
    RestaurantStatus.BLOCKED,
    RestaurantStatus.PENDING,
]


async def seed_if_empty(db: AsyncSession) -> None:
    existing = await db.scalar(select(SubscriptionPackage.id).limit(1))
    if existing is not None:
        return

    now = datetime.now(timezone.utc)

    packages = [
        SubscriptionPackage(name="Podstawowy"),
        SubscriptionPackage(name="Wyższy"),
        SubscriptionPackage(name="Premium"),
    ]
    db.add_all(packages)
    await db.flush()

    restaurants: list[Restaurant] = []
    for index, name in enumerate(_RESTAURANT_NAMES):
        slug = "".join(ch for ch in name.lower() if ch.isalnum())
        restaurants.append(
            Restaurant(
                name=name,
                contact_email=f"kontakt@{slug}.pl",
                contact_phone=f"+48 {500 + index} {100 + index} {200 + index}",
                package_id=packages[index % len(packages)].id,
                status=_STATUSES[index % len(_STATUSES)],
                subscription_valid_until=now + timedelta(days=(index - 2) * 20),
                # Pleasant defaults on the demo (first) restaurant.
                primary_color="#8C1D18" if index == 0 else "#d32f2f",
                background_color="#FCF4F6" if index == 0 else "#ffffff",
                font_family="Playfair Display" if index == 0 else "Roboto",
            )
        )
    db.add_all(restaurants)
    await db.flush()

    await _seed_demo_menu(db, restaurants[0])


async def _seed_demo_menu(db: AsyncSession, restaurant: Restaurant) -> None:
    przystawki = MenuCategory(
        restaurant_id=restaurant.id, name="Przystawki", sort_order=1
    )
    zupy = MenuCategory(restaurant_id=restaurant.id, name="Zupy", sort_order=2)
    desery = MenuCategory(restaurant_id=restaurant.id, name="Desery", sort_order=3)
    db.add_all([przystawki, zupy, desery])
    await db.flush()

    db.add_all(
        [
            MenuItem(
                category_id=przystawki.id,
                name="Bruschetta Pomodoro",
                price=24.90,
                description="Chrupiąca grzanka z pomidorami i bazylią",
                ingredients="pomidory, bazylia, oliwa z oliwek, czosnek, bagietka",
                allergens=["Gluten"],
                tags=["Wegetariańskie", "Bestseller"],
                is_available=True,
                sort_order=1,
            ),
            MenuItem(
                category_id=przystawki.id,
                name="Carpaccio z polędwicy",
                price=42.00,
                description="Cienkie plastry wołowiny z rukolą i parmezanem",
                ingredients="polędwica wołowa, rukola, parmezan, kapary, oliwa",
                allergens=["Laktoza"],
                tags=[],
                is_available=False,
                sort_order=2,
            ),
            MenuItem(
                category_id=przystawki.id,
                name="Krewetki w tempurze",
                price=38.50,
                description="Z sosem sweet chili i limonką",
                ingredients="krewetki, mąka pszenna, sos sweet chili, limonka",
                allergens=["Gluten", "Ryby"],
                tags=["Pikantne", "Nowość"],
                is_available=True,
                sort_order=3,
            ),
            MenuItem(
                category_id=zupy.id,
                name="Krem z pomidorów",
                price=19.90,
                description="Z grzankami ziołowymi i śmietanką",
                ingredients="pomidory, śmietanka, bazylia, grzanki",
                allergens=["Gluten", "Laktoza"],
                tags=["Wegetariańskie"],
                is_available=True,
                sort_order=1,
            ),
            MenuItem(
                category_id=zupy.id,
                name="Ramen Tonkotsu",
                price=44.00,
                description="Bogaty bulion wieprzowy, makaron, jajko marynowane",
                ingredients="bulion wieprzowy, makaron, jajko, boczek chashu, nori",
                allergens=["Gluten", "Jaja", "Soja"],
                tags=["Bestseller"],
                is_available=True,
                sort_order=2,
            ),
        ]
    )
    await db.flush()
