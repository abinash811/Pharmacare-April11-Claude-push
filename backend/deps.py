"""Shared dependencies for all routers — SQLAlchemy async session."""
from __future__ import annotations

from database import get_db, AsyncSessionLocal, engine  # noqa: F401 — re-exported for routers

__all__ = ["get_db", "AsyncSessionLocal", "engine"]
