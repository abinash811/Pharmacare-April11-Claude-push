"""
Cross-store stock transfer (multi-chain Phase 2, Step 5,
docs/26_MULTI_CHAIN_SCOPE.md). A transfer moves real stock from one
pharmacy in a chain to another, instantly (v1 — no in-transit holding
state), preserving the exact batch number/cost/MRP/expiry at the
destination. `is_cross_gstin` is computed at creation time by comparing
the two stores' GSTINs — it classifies whether this legally needs a tax
invoice (different GSTIN) or just an internal record (same GSTIN or
either store has none set yet); this app does not generate the actual
challan/tax-invoice/e-way-bill document itself, that's a bigger, separate
build.
"""
from __future__ import annotations
import uuid
from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy import TIMESTAMP

from database import Base


class StockTransfer(Base):
    __tablename__ = "stock_transfers"
    __table_args__ = (
        UniqueConstraint("source_pharmacy_id", "transfer_number"),
        Index("idx_stock_transfers_source", "source_pharmacy_id"),
        Index("idx_stock_transfers_destination", "destination_pharmacy_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_number: Mapped[str] = mapped_column(String(50), nullable=False)
    source_pharmacy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    destination_pharmacy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    transfer_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=func.current_date())
    is_cross_gstin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_gstin: Mapped[Optional[str]] = mapped_column(String(15))
    destination_gstin: Mapped[Optional[str]] = mapped_column(String(15))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    initiated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reversed_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    reversed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"
    __table_args__ = (
        Index("idx_stock_transfer_items_transfer", "transfer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False)
    product_sku: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    mrp_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    source_batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_batches.id"), nullable=False)
    destination_batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_batches.id"), nullable=False)
    created_at: Mapped[str] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
