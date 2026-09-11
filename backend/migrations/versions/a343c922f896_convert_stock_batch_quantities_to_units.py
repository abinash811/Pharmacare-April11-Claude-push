"""convert_stock_batch_quantities_to_units

Revision ID: a343c922f896
Revises: 6f51c99eca91
Create Date: 2026-09-11 02:53:49.030405

Data-only migration, no column type change. Every stock_batches.quantity_*
column (quantity_on_hand, quantity_received, quantity_sold,
quantity_returned, quantity_written_off) was stored in whole PACKS, while
every write site (billing, purchases, purchase returns, sales returns,
manual adjustments) received quantities in loose UNITS and floor-divided
by the product's units_per_pack before storing. Found live Sep 11, 2026:
selling 2 loose tablets from a 10-tablet strip computed `2 // 10 = 0`
packs, so the batch's recorded stock never moved — the app's own
documented "sell 5 loose tablets from a 10-tablet strip" feature silently
never deducted stock for any sale that wasn't an exact multiple of the
pack size. The same floor-division existed independently at every other
write site (see docs/15_ROADMAP.md RULE MISSES LOG for the full list).

Fix (code side, this same change): every write site now stores/reads the
quantity it's given directly, with no pack conversion — units_per_pack is
never applied to a stored quantity again. This migration is the one-time
data conversion so existing batches keep meaning what they physically
are: a batch that has always meant "100 packs of 10" becomes "1000 units"
here, not silently reinterpreted as "100 units" (i.e. 10 strips) once the
code stops converting.

Product.reorder_level and reorder_quantity are deliberately NOT touched
here — reorder_level's own API field name (low_stock_threshold_units) was
always documented as units, but the comparison against quantity_on_hand
(packs, until now) never actually was. This migration makes that
comparison correct for the first time as a side effect, not by changing
reorder_level's stored value.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a343c922f896'
down_revision: Union[str, None] = '6f51c99eca91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE stock_batches sb
        SET quantity_on_hand      = sb.quantity_on_hand      * p.units_per_pack,
            quantity_received     = sb.quantity_received     * p.units_per_pack,
            quantity_sold         = sb.quantity_sold         * p.units_per_pack,
            quantity_returned     = sb.quantity_returned     * p.units_per_pack,
            quantity_written_off  = sb.quantity_written_off  * p.units_per_pack
        FROM products p
        WHERE sb.product_id = p.id
          AND p.units_per_pack > 1
    """)


def downgrade() -> None:
    # Best-effort reverse: floor-divide back to packs. Lossy for any batch
    # whose real unit count isn't an exact multiple of units_per_pack (e.g.
    # a batch legitimately at 1007 units with units_per_pack=10 becomes 100
    # packs, not 100.7) — that loss is expected and acceptable for a
    # downgrade path, same as any "make the smaller unit the source of
    # truth" migration.
    op.execute("""
        UPDATE stock_batches sb
        SET quantity_on_hand      = sb.quantity_on_hand      / p.units_per_pack,
            quantity_received     = sb.quantity_received     / p.units_per_pack,
            quantity_sold         = sb.quantity_sold         / p.units_per_pack,
            quantity_returned     = sb.quantity_returned     / p.units_per_pack,
            quantity_written_off  = sb.quantity_written_off  / p.units_per_pack
        FROM products p
        WHERE sb.product_id = p.id
          AND p.units_per_pack > 1
    """)
