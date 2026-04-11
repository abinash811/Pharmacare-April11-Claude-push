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


class Purchase(Base):
    __tablename__ = "purchases"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "purchase_number"),
        Index("idx_purchases_pharmacy", "pharmacy_id"),
        Index("idx_purchases_supplier", "supplier_id"),
        Index("idx_purchases_status", "pharmacy_id", "status"),
        Index("idx_purchases_date", "pharmacy_id", "purchase_date"),
        Index("idx_purchases_unpaid", "pharmacy_id", postgresql_where=text("payment_status = 'unpaid'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    purchase_number: Mapped[str] = mapped_column(String(50), nullable=False)
    supplier_invoice_number: Mapped[Optional[str]] = mapped_column(String(100))
    supplier_invoice_date: Mapped[Optional[date]] = mapped_column(Date)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    grn_number: Mapped[Optional[str]] = mapped_column(String(50))
    received_date: Mapped[Optional[date]] = mapped_column(Date)
    subtotal_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_gst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_sgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_igst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grand_total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    amount_paid_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    deleted_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    __table_args__ = (
        Index("idx_purchase_items_purchase", "purchase_id"),
        Index("idx_purchase_items_product", "product_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_batches.id"))
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    batch_number: Mapped[Optional[str]] = mapped_column(String(100))
    expiry_date: Mapped[Optional[date]] = mapped_column(Date)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10))
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    units_per_pack: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    mrp_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    cgst_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    sgst_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    igst_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    taxable_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    gst_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class PurchasePayment(Base):
    __tablename__ = "purchase_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchases.id"), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    reference_number: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "return_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchases.id"), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    return_number: Mapped[str] = mapped_column(String(50), nullable=False)
    return_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    return_reason: Mapped[str] = mapped_column(String(50), nullable=False)
    subtotal_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_gst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grand_total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    credit_note_number: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PurchaseReturnItem(Base):
    __tablename__ = "purchase_return_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_return_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_returns.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_batches.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    gst_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
