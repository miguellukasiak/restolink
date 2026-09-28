"""Recording what HQ staff do.

One function and a list of action names. The names are stable tokens rather
than sentences: the panel renders them into Polish, so rewording the UI does
not orphan three years of history, and a future "show me every impersonation"
filter has something exact to match on.

**Rows are written in the caller's transaction**, deliberately. `get_db`
commits once at the end of a successful request and rolls back on failure, so
a log entry survives exactly when the action it describes did. The alternative
— a separate connection that commits immediately — would record attempts that
then failed, and an audit trail that says a restaurant was created when it was
not is worse than no entry at all.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from .models import AuditLog

logger = logging.getLogger(__name__)

# --- Actions --------------------------------------------------------------- #
# Kept short and past-tense. Add to this list rather than passing loose strings
# at call sites, so the set stays enumerable.

ADMIN_CREATED = "admin.created"
ADMIN_REVOKED = "admin.revoked"
RESTAURANT_CREATED = "restaurant.created"
RESTAURANT_PAYMENT_RECORDED = "restaurant.payment_recorded"
RESTAURANT_IMPERSONATED = "restaurant.impersonated"
RESTAURANT_UPDATED = "restaurant.updated"
#: The welcome email was sent again. Separate from the one below because the
#: difference matters when tracing how someone got access: one went to an
#: inbox, the other was handed to an operator to pass on by hand.
RESTAURANT_ACTIVATION_SENT = "restaurant.activation_sent"
RESTAURANT_ACTIVATION_LINK_ISSUED = "restaurant.activation_link_issued"
#: Written by the Stripe webhook, whose actor is not a person. `admin_email`
#: holds `system:stripe-webhook` for these — the column is the actor, and
#: pretending a human did it would be the one lie an audit trail cannot afford.
SUBSCRIPTION_PAID = "subscription.paid"

#: Bounds match the columns; a target longer than the column would otherwise
#: fail the insert and take the whole action down with it.
_MAX_TARGET = 255


async def record(
    db: AsyncSession, *, admin_email: str, action: str, target_entity: str
) -> None:
    """Append one entry. Call it after the action has been staged, not before."""
    db.add(
        AuditLog(
            admin_email=admin_email[:_MAX_TARGET],
            action=action,
            target_entity=target_entity[:_MAX_TARGET],
        )
    )
    # Also to the application log, where an operator watching Render sees it
    # without opening the panel.
    logger.info("AUDIT %s by %s on %s", action, admin_email, target_entity)
