"""
Regression tests for the Sep 19, 2026 sequence-number digit-boundary bug.

Bug: _generate_purchase_number (routers/purchases.py), and
_generate_return_number / _generate_debit_number (routers/purchase_returns.py)
all found "the last number" via `ORDER BY <purchase_number column> DESC
LIMIT 1` on the zero-padded string column, then parsed the numeric suffix
out of it in Python. That breaks the moment the suffix crosses a
zero-padding digit-width boundary: "PUR-2026-9999" sorts AFTER
"PUR-2026-10000" lexicographically (the string comparison sees '9' > '1' at
the first differing character), so the query returns the wrong "last" row
once a pharmacy crosses 9999 purchases/returns/debit notes in a calendar
year. The next generated number then collides with one that already
exists, and — because the collision keeps recomputing the same way — every
subsequent creation for that pharmacy 500s on a duplicate-key
IntegrityError (`purchases_pharmacy_id_purchase_number_key`) from then on.
Found live: a dev DB that had accumulated 10,202 test purchases started
500ing on every new confirmed purchase.

Fix: compute MAX() on the numeric suffix cast to an integer in SQL
(func.split_part + cast(..., Integer)), never by ordering the padded
string column.

These three functions are pure DB-query logic with no HTTP-observable
symptom until a real duplicate is hit — reproducing the bug through the
real API would mean actually creating 10,000+ real purchases per test run.
Directly seeding a couple of boundary rows and calling the generator
function is the only practical way to prove this fix, which is why this
file (uniquely in this suite) talks to the database directly instead of
only through `requests` like every other file in `backend/tests/`.
"""
import asyncio
import os
import uuid

import pytest
import requests

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, engine
from models.purchases import Purchase as PurchaseORM, PurchaseReturn as PurchaseReturnORM
from routers.purchase_returns import _generate_debit_number, _generate_return_number
from routers.purchases import _generate_purchase_number

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')


def _run(coro_fn):
    """Run a zero-arg async callable via asyncio.run(), disposing the
    shared async engine's connection pool at the end of that *same* event
    loop, before it closes. Each call in this file gets its own fresh loop
    (a plain pytest test has no long-lived loop to share) — but
    `database.py`'s module-level `engine`/`AsyncSessionLocal` pool real
    asyncpg connections, which are bound to the loop they were opened
    under. Disposing from a *second*, later asyncio.run() call doesn't
    work either (the pool's graceful-close still touches state tied to the
    first, now-dead loop) — disposal has to happen inside the same
    coroutine that used the pool. Every other file in this suite avoids
    this entirely by only ever talking HTTP, never the DB directly — this
    helper is what makes this file's direct-DB exception safe to repeat
    across multiple tests in one process."""
    async def _inner():
        try:
            return await coro_fn()
        finally:
            await engine.dispose()
    return asyncio.run(_inner())


class TestSequenceNumberDigitBoundary:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123",
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed - skipping sequence digit-boundary tests")
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        me = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 200, me.text
        # /auth/me doesn't return pharmacy_id despite what docs/10_API.md
        # claims (found while writing this test) -- GET /users/{id} does.
        user_detail = self.session.get(f"{BASE_URL}/api/users/{me.json()['id']}")
        assert user_detail.status_code == 200, user_detail.text
        self.pharmacy_id = uuid.UUID(user_detail.json()["pharmacy_id"])

        supplier_resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"Digit Boundary Test Supplier {uuid.uuid4().hex[:8]}",
        })
        assert supplier_resp.status_code == 200, supplier_resp.text
        self.supplier_id = uuid.UUID(supplier_resp.json()["id"])

        self._purchase_ids = []
        self._return_ids = []
        yield
        # This file is the one place in the suite that can actually honor
        # this doc's own "clean up test data" rule (docs/11_TESTING.md, TEST
        # DATA RULES), since it controls exactly which synthetic rows it
        # inserted directly. Runs (and disposes the engine) in its own
        # asyncio.run() call, same as each test's `scenario()` — see the
        # `_run` helper's docstring for why that matters here.
        _run(self._cleanup)

    async def _cleanup(self):
        # Core delete() statements, flushed to the DB in two explicit
        # round trips (returns committed before purchases are even
        # attempted) — not ORM db.get()+db.delete(), which left the
        # returns undeleted by the time the purchases DELETE ran (both
        # queued in one flush, and the delete-order guarantee that
        # normally gives didn't hold here for reasons not worth chasing
        # further in a one-off test-cleanup helper).
        if self._return_ids:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(PurchaseReturnORM).where(PurchaseReturnORM.id.in_(self._return_ids)))
                await db.commit()
        if self._purchase_ids:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(PurchaseORM).where(PurchaseORM.id.in_(self._purchase_ids)))
                await db.commit()

    async def _seed_purchase(self, db: AsyncSession, purchase_number: str) -> uuid.UUID:
        row = PurchaseORM(
            id=uuid.uuid4(), pharmacy_id=self.pharmacy_id, supplier_id=self.supplier_id,
            purchase_number=purchase_number,
        )
        db.add(row)
        await db.flush()
        self._purchase_ids.append(row.id)
        return row.id

    async def _seed_return(
            self, db: AsyncSession, purchase_id: uuid.UUID, return_number: str,
            debit_note_number: str | None = None) -> uuid.UUID:
        row = PurchaseReturnORM(
            id=uuid.uuid4(), pharmacy_id=self.pharmacy_id, purchase_id=purchase_id,
            supplier_id=self.supplier_id, return_number=return_number,
            return_reason="Digit boundary regression test", debit_note_number=debit_note_number,
        )
        db.add(row)
        await db.flush()
        self._return_ids.append(row.id)
        return row.id

    # Deliberately a large, 6-digit number, not literally 9999/10000 — this
    # dev DB already has real purchases past 10000 from other test runs
    # (that accumulation is itself flagged in docs/11_TESTING.md's CI
    # STATUS). Any digit-width boundary reproduces the bug; a number this
    # large just avoids colliding with whatever real data already exists.
    _BOUNDARY_SEED = 823456

    def test_purchase_number_survives_5_digit_boundary(self):
        """A 6-digit purchase_number already on file must not make the next
        generated number collide with it (the actual bug: it did, because
        e.g. "...-9999" sorts AFTER "...-10000")."""
        year = datetime_year()
        seed = self._BOUNDARY_SEED

        async def scenario():
            async with AsyncSessionLocal() as db:
                await self._seed_purchase(db, f"PUR-{year}-{seed}")
                await db.commit()
                return await _generate_purchase_number(self.pharmacy_id, db)

        next_number = _run(scenario)
        assert next_number == f"PUR-{year}-{seed + 1:04d}", (
            f"Expected the number after {seed} to be {seed + 1}, got {next_number!r} — "
            "a value less than or equal to the seed means the digit-boundary bug is back.")

    def test_return_number_survives_5_digit_boundary(self):
        year = datetime_year()
        seed = self._BOUNDARY_SEED

        async def scenario():
            async with AsyncSessionLocal() as db:
                purchase_id = await self._seed_purchase(db, f"PUR-{year}-{_placeholder_number()}")
                await self._seed_return(db, purchase_id, f"PRET-{year}-{seed}")
                await db.commit()
                return await _generate_return_number(self.pharmacy_id, db)

        next_number = _run(scenario)
        assert next_number == f"PRET-{year}-{seed + 1:04d}"

    def test_debit_note_number_survives_5_digit_boundary(self):
        year = datetime_year()
        seed = self._BOUNDARY_SEED

        async def scenario():
            async with AsyncSessionLocal() as db:
                purchase_id = await self._seed_purchase(db, f"PUR-{year}-{_placeholder_number()}")
                await self._seed_return(
                    db, purchase_id, f"PRET-{year}-{_placeholder_number()}",
                    debit_note_number=f"SDN-{year}-{seed}")
                await db.commit()
                return await _generate_debit_number(self.pharmacy_id, db)

        next_number = _run(scenario)
        assert next_number == f"SDN-{year}-{seed + 1:04d}"


def datetime_year() -> int:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).year


def _placeholder_number() -> str:
    """A random *numeric* suffix for a throwaway seed row that only needs
    to satisfy an FK, not exercise the generator being tested. Must stay
    numeric: _generate_purchase_number's fix does `MAX(CAST(split_part(...)
    AS INTEGER))` over every row matching the prefix, so a non-numeric
    suffix here (a hex string was tried first) throws
    InvalidTextRepresentationError for every other test's call, not just
    this row's own."""
    return str(uuid.uuid4().int % 900000 + 100000)
