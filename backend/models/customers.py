from __future__ import annotations
import uuid
from typing import Optional
from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy import TIMESTAMP

from database import Base


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        Index("idx_customers_pharmacy", "pharmacy_id"),
        Index("idx_customers_phone", "pharmacy_id", "phone"),
        Index("idx_customers_name", "pharmacy_id", "name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(10))
    alternate_phone: Mapped[Optional[str]] = mapped_column(String(10))
    email: Mapped[Optional[str]] = mapped_column(String(200))
    age: Mapped[Optional[int]] = mapped_column(Integer)
    gender: Mapped[Optional[str]] = mapped_column(String(10))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    customer_type: Mapped[str] = mapped_column(String(20), default="retail", nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(15))
    credit_limit_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credit_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    outstanding_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    loyalty_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deleted_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Doctor(Base):
    __tablename__ = "doctors"
    __table_args__ = (
        Index("idx_doctors_pharmacy", "pharmacy_id"),
        Index("idx_doctors_name", "pharmacy_id", "name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    qualification: Mapped[Optional[str]] = mapped_column(String(200))
    specialization: Mapped[Optional[str]] = mapped_column(String(200))
    registration_number: Mapped[Optional[str]] = mapped_column(String(100))
    hospital: Mapped[Optional[str]] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(10))
    address: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deleted_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
