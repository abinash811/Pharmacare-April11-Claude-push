from __future__ import annotations
import uuid
from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Date, Integer, Numeric, String, Text, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy import TIMESTAMP

from database import Base


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(6), nullable=False)
    phone: Mapped[str] = mapped_column(String(10), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(200))
    gstin: Mapped[Optional[str]] = mapped_column(String(15))
    drug_license_number: Mapped[Optional[str]] = mapped_column(String(50))
    drug_license_expiry: Mapped[Optional[date]] = mapped_column(Date)
    fssai_number: Mapped[Optional[str]] = mapped_column(String(20))
    pan_number: Mapped[Optional[str]] = mapped_column(String(10))
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    settings: Mapped[Optional[PharmacySettings]] = relationship(back_populates="pharmacy", uselist=False)


class PharmacySettings(Base):
    __tablename__ = "pharmacy_settings"
    __table_args__ = (UniqueConstraint("pharmacy_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    # Bill sequence
    bill_prefix: Mapped[str] = mapped_column(String(10), default="INV", nullable=False)
    bill_sequence_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    bill_number_length: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    # Inventory
    low_stock_threshold_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    near_expiry_threshold_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    # GST
    default_gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=5.00, nullable=False)
    # Print
    print_logo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    print_drug_license: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    print_patient_name: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    pharmacy: Mapped[Pharmacy] = relationship(back_populates="settings")
