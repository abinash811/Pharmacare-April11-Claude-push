"""sync_default_role_permissions_from_constants

Revision ID: 25ea9247b0c3
Revises: a343c922f896
Create Date: 2026-09-12 02:54:04.405075

Data-only migration. constants.py's DEFAULT_ROLES was fixed (Sep 12, 2026)
to add "purchases:edit" to manager (it was missing, so a manager creating
a purchase could never edit their own draft — the exact failure
test_purchase_permissions.py::test_manager_can_create_and_edit_purchase
caught) and to add "suppliers:view/create/edit/deactivate" to manager and
"suppliers:view/create" to inventory_staff (needed now that
routers/suppliers.py enforces permissions for the first time — until now
ANY role, including cashier, could create/edit suppliers with zero check).

Editing the Python constant alone does not change already-seeded `roles`
rows already sitting in a pharmacy's database — this migration updates
those in place for the two affected system roles. Scoped to
is_system_role=True rows only, so a pharmacy that has since customized
its own "manager"/"inventory_staff" role via Team > Roles is not silently
overwritten — pre-launch, no real pharmacy has done this yet, so this is
a safe default-sync, not a real-world risk today.
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '25ea9247b0c3'
down_revision: Union[str, None] = 'a343c922f896'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MANAGER_PERMISSIONS_OLD = [
    "dashboard:view", "billing:create", "billing:view", "billing:edit",
    "inventory:view", "inventory:edit", "inventory:create", "inventory:batches_view",
    "inventory:batches_create", "inventory:stock_adjust",
    "purchases:create", "purchases:view", "purchase_returns:create",
    "purchase_returns:view", "sales_returns:create", "sales_returns:view",
    "customers:view", "customers:edit", "customers:create", "reports:view",
]
MANAGER_PERMISSIONS_NEW = [
    "dashboard:view", "billing:create", "billing:view", "billing:edit",
    "inventory:view", "inventory:edit", "inventory:create", "inventory:batches_view",
    "inventory:batches_create", "inventory:stock_adjust",
    "purchases:create", "purchases:view", "purchases:edit", "purchase_returns:create",
    "purchase_returns:view", "sales_returns:create", "sales_returns:view",
    "customers:view", "customers:edit", "customers:create", "reports:view",
    "suppliers:view", "suppliers:create", "suppliers:edit", "suppliers:deactivate",
]
INVENTORY_STAFF_PERMISSIONS_OLD = [
    "dashboard:view", "inventory:view", "inventory:edit", "inventory:create",
    "inventory:batches_view", "inventory:batches_create", "inventory:stock_adjust",
    "purchases:create", "purchases:view", "purchase_returns:create",
    "purchase_returns:view",
]
INVENTORY_STAFF_PERMISSIONS_NEW = [
    "dashboard:view", "inventory:view", "inventory:edit", "inventory:create",
    "inventory:batches_view", "inventory:batches_create", "inventory:stock_adjust",
    "purchases:create", "purchases:view", "purchase_returns:create",
    "purchase_returns:view", "suppliers:view", "suppliers:create",
]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE roles SET permissions = CAST(:perms AS jsonb) "
                "WHERE name = 'manager' AND is_system_role = true"),
        {"perms": json.dumps(MANAGER_PERMISSIONS_NEW)},
    )
    conn.execute(
        sa.text("UPDATE roles SET permissions = CAST(:perms AS jsonb) "
                "WHERE name = 'inventory_staff' AND is_system_role = true"),
        {"perms": json.dumps(INVENTORY_STAFF_PERMISSIONS_NEW)},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE roles SET permissions = CAST(:perms AS jsonb) "
                "WHERE name = 'manager' AND is_system_role = true"),
        {"perms": json.dumps(MANAGER_PERMISSIONS_OLD)},
    )
    conn.execute(
        sa.text("UPDATE roles SET permissions = CAST(:perms AS jsonb) "
                "WHERE name = 'inventory_staff' AND is_system_role = true"),
        {"perms": json.dumps(INVENTORY_STAFF_PERMISSIONS_OLD)},
    )
