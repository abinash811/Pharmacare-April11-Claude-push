from __future__ import annotations
import uuid
from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String, Text, Time, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy import TIMESTAMP

from database import Base


class Bill(Base):
    __tablename__ = "bills"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "bill_number"),
        Index("idx_bills_pharmacy", "pharmacy_id"),
        Index("idx_bills_date", "pharmacy_id", "bill_date"),
        Index("idx_bills_customer", "customer_id"),
        Index("idx_bills_status", "pharmacy_id", "status"),
        Index("idx_bills_number", "pharmacy_id", "bill_number"),
        Index("idx_bills_paid", "pharmacy_id", "bill_date", postgresql_where=text("status = 'paid'")),
        Index("idx_bills_due", "pharmacy_id", postgresql_where=text("status = 'due'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    bill_number: Mapped[str] = mapped_column(String(50), nullable=False)
    invoice_type: Mapped[str] = mapped_column(String(20), default="retail", nullable=False)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    bill_time: Mapped[Optional[str]] = mapped_column(Time(timezone=True), server_default=func.current_time())
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"))
    customer_name: Mapped[Optional[str]] = mapped_column(String(200))
    customer_phone: Mapped[Optional[str]] = mapped_column(String(10))
    customer_gstin: Mapped[Optional[str]] = mapped_column(String(15))
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    doctor_name: Mapped[Optional[str]] = mapped_column(String(200))
    prescription_number: Mapped[Optional[str]] = mapped_column(String(100))
    prescription_date: Mapped[Optional[date]] = mapped_column(Date)
    subtotal_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mrp_total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    item_discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bill_discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bill_discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    total_discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    taxable_amount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_sgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_igst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_gst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grand_total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    amount_paid_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    balance_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payment_method: Mapped[Optional[str]] = mapped_column(String(20))
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100))
    cost_total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    margin_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    margin_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    internal_note: Mapped[Optional[str]] = mapped_column(Text)
    delivery_note: Mapped[Optional[str]] = mapped_column(Text)
    billed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    deleted_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class BillItem(Base):
    __tablename__ = "bill_items"
    __table_args__ = (
        Index("idx_bill_items_bill", "bill_id"),
        Index("idx_bill_items_product", "product_id"),
        Index("idx_bill_items_batch", "batch_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bills.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_batches.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    generic_name: Mapped[Optional[str]] = mapped_column(String(300))
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10))
    drug_schedule: Mapped[Optional[str]] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    mrp_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    sale_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    cgst_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    sgst_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    igst_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    taxable_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    cgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sgst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    igst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    line_cost_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class SalesReturn(Base):
    __tablename__ = "sales_returns"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "return_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    original_bill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bills.id"), nullable=False)
    return_number: Mapped[str] = mapped_column(String(50), nullable=False)
    return_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    return_reason: Mapped[Optional[str]] = mapped_column(Text)
    total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_gst_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grand_total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    refund_method: Mapped[Optional[str]] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sales_return_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False)
    bill_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bill_items.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_batches.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    sale_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    gst_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    return_to_stock: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class ScheduleH1Register(Base):
    __tablename__ = "schedule_h1_register"
    __table_args__ = (
        Index("idx_h1_pharmacy", "pharmacy_id"),
        Index("idx_h1_date", "pharmacy_id", "supply_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    bill_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bills.id"))
    bill_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bill_items.id"))
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    prescriber_name: Mapped[str] = mapped_column(String(200), nullable=False)
    prescriber_registration_number: Mapped[Optional[str]] = mapped_column(String(100))
    prescriber_address: Mapped[Optional[str]] = mapped_column(Text)
    patient_name: Mapped[str] = mapped_column(String(200), nullable=False)
    patient_address: Mapped[Optional[str]] = mapped_column(Text)
    patient_age: Mapped[Optional[int]] = mapped_column(Integer)
    supply_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    dispensed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
