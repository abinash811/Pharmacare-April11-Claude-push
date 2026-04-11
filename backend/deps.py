"""Shared dependencies for all routers — MongoDB client, db object, and helpers."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url: str = os.environ["MONGO_URL"]
_client: AsyncIOMotorClient = AsyncIOMotorClient(mongo_url)
db = _client[os.environ["DB_NAME"]]
