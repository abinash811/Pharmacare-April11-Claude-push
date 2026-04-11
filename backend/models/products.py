from __future__ import annotations
import uuid
from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy import TIMESTAMP

from database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "sku"),
        Index("idx_products_pharmacy", "pharmacy_id"),
        Index("idx_products_name", "pharmacy_id", "name"),
        Index("idx_products_barcode", "pharmacy_id", "barcode"),
        Index("idx_products_generic", "pharmacy_id", "generic_name"),
        Index("idx_products_schedule", "pharmacy_id", "drug_schedule"),
        Index("idx_products_active", "pharmacy_id", "is_active", postgresql_where=text("deleted_at IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    barcode: Mapped[Optional[str]] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    generic_name: Mapped[Optional[str]] = mapped_column(String(300))
    brand: Mapped[Optional[str]] = mapped_column(String(200))
    manufacturer: Mapped[Optional[str]] = mapped_column(String(200))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    drug_schedule: Mapped[str] = mapped_column(String(20), default="OTC", nullable=False)
    dosage_form: Mapped[Optional[str]] = mapped_column(String(100))
    strength: Mapped[Optional[str]] = mapped_column(String(100))
    pack_size: Mapped[Optional[str]] = mapped_column(String(100))
    units_per_pack: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    hsn_code: Mapped[str] = mapped_column(String(10), default="3004", nullable=False)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=5.00, nullable=False)
    reorder_level: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    reorder_quantity: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    storage_location: Mapped[Optional[str]] = mapped_column(String(100))
    requires_refrigeration: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deleted_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class StockBatch(Base):
    __tablename__ = "stock_batches"
    __table_args__ = (
        Index("idx_batches_product", "product_id"),
        Index("idx_batches_expiry", "pharmacy_id", "expiry_date"),
        Index("idx_batches_quantity", "product_id", "quantity_on_hand"),
        Index("idx_batches_active", "product_id", "quantity_on_hand", postgresql_where=text("is_active = TRUE")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    manufacture_date: Mapped[Optional[date]] = mapped_column(Date)
    mrp_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    sale_price_paise: Mapped[Optional[int]] = mapped_column(Integer)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_sold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_returned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_written_off: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("idx_movements_batch", "batch_id"),
        Index("idx_movements_product", "product_id"),
        Index("idx_movements_pharmacy", "pharmacy_id", "created_at"),
        Index("idx_movements_reference", "reference_type", "reference_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_batches.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    movement_type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_before: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
