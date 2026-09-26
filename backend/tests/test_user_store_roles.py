"""
Regression tests for the Sep 26, 2026 multi-chain Phase 2 groundwork
(docs/26_MULTI_CHAIN_SCOPE.md): the new `user_store_roles` table must stay
a complete, correct mirror of `users.pharmacy_id`/`role_id` from the
moment a user is created — not just backfilled once at migration time
(migration `3bc60ce0ce95`).

Nothing reads this table yet (login/permission checks are unchanged) — it
exists so a later switcher/multi-store step doesn't need a second
backfill pass. Talks to the DB directly, same pattern and same reason as
`test_sequence_number_digit_boundary.py`: this is pure DB-state, invisible
over the real API.
"""
import asyncio
import os
import uuid

import requests

from sqlalchemy import select

from database import AsyncSessionLocal, engine
from models.users import UserStoreRole

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')


def _run(coro_fn):
    """See test_sequence_number_digit_boundary.py's identical helper for
    why this exists — engine disposal must happen inside the same event
    loop that used the connection pool."""
    async def _inner():
        try:
            return await coro_fn()
        finally:
            await engine.dispose()
    return asyncio.run(_inner())


def _user_store_role(user_id: str):
    async def _query():
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(UserStoreRole).where(UserStoreRole.user_id == uuid.UUID(user_id)))
            return result.scalar_one_or_none()
    return _run(_query)


class TestUserStoreRoles:
    def test_register_creates_matching_user_store_role(self):
        suffix = uuid.uuid4().hex[:8]
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"usr_{suffix}@pharmacy.com", "name": "USR Test Admin",
            "password": "UsrTest123", "phone": "9855550000",
            "pharmacy_name": f"USR Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-USR-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        user_id = resp.json()["user"]["id"]

        row = _user_store_role(user_id)
        assert row is not None
        assert str(row.user_id) == user_id

    def test_adding_a_team_member_creates_matching_user_store_role(self):
        suffix = uuid.uuid4().hex[:8]
        admin = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"usrteam_{suffix}@pharmacy.com", "name": "USR Team Test Admin",
            "password": "UsrTeamTest123", "phone": "9855550001",
            "pharmacy_name": f"USR Team Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-USRTEAM-{suffix}",
        })
        assert admin.status_code == 200, admin.text
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin.json()['token']}",
        })

        member_email = f"usrmember_{suffix}@pharmacy.com"
        member = session.post(f"{BASE_URL}/api/users", json={
            "email": member_email, "name": "USR Team Member",
            "password": "UsrMemberTest123", "role": "cashier",
        })
        assert member.status_code == 200, member.text

        row = _user_store_role(member.json()["id"])
        assert row is not None
        assert str(row.user_id) == member.json()["id"]
