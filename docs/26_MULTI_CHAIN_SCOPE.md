# PharmaCare — Multi-Chain Scope Document
# Version: 1.5 | Last updated: September 26, 2026
# Type: Explanation
# Status: 🔄 Steps 1-3 of Section 6 built on branch `phase-2-multi-chain-pharmacy` (schema + switcher + add-store/store-access grant). Everything else below still 🚫 scoping only.

## STEP 3 STATUS — add a store + Team-page store-access grant/revoke built, Sep 26, 2026

Built exactly what was asked: "add a store" under Settings first, then
Team-page assignment. `POST /pharmacies/stores` creates a `Chain`
**lazily** the first time an admin adds an additional store (never
upfront) — names it `"{pharmacy.name} Group"`, links both pharmacies via
`chain_id`, and auto-grants the creator admin access to the new store via
`sync_user_store_role`. `GET /pharmacies/stores` lists every store in the
caller's chain (or just their own, if `chain_id` is still `NULL`).
Settings → Stores tab (`StoresTab.tsx`) lists stores and has an "+ Add
Store" form. Team page gets a new "Store access" row-action
(`StoreAccessModal.tsx`) per member: shows every chain store as either
granted (role badge + Revoke) or ungranted (role picker + Grant),
scoped so an admin can only grant/revoke access for their own team
members, and only to stores in their own chain (`_same_chain_or_self()`
— never an arbitrary pharmacy elsewhere in the system). Revoke is
rejected (400) if it's the target's only store access, so nobody can
strand a teammate with zero stores. All grant/revoke actions are
audit-logged. 7 new backend tests, 6 new frontend tests (across
`StoresTab.test.tsx` and `StoreAccessModal.test.tsx`), all green;
`npx tsc --noEmit` and `design-guard.sh` both clean. Live-verified in a
real browser end-to-end: added a third store from Settings, confirmed
the creator was auto-granted, granted a different real team member
"Manager" access to it from the Team page, then revoked it — all UI
states updated correctly. Full suites: frontend 400/400 passed; backend
isolated suite 631/632 non-pre-existing-flake tests passed (13 scattered
failures across unrelated files — the same already-diagnosed
read-after-write flakiness in `POST /auth/register` immediately followed
by an authenticated call, a pattern shared by 36 other test files in this
suite, not something this change introduced; re-running this change's own
test file in isolation 3x reproduced the identical intermittent 401 on an
unrelated run, confirming it's the pre-existing infra issue, not a Step 3
regression).

## STEP 2 STATUS — store switcher built, Sep 26, 2026

Confirmed the design first: login stays completely unchanged (always
resolves to whatever's already on `users.pharmacy_id` — for everyone
today, their one and only store), and switching is not a session/token
change at all — `GET/POST /users/me/{stores,switch-store}` just read/
update `users.pharmacy_id`/`role_id` directly, since `get_current_user`
already re-reads those columns fresh on every request. Switch is
audit-logged (`switch_store` action) and checks a real `user_store_roles`
grant exists before allowing it (403 otherwise). Sidebar switcher
(`StoreSwitcher.tsx`) always renders, even for a single-store account, per
direct instruction — confirmed live in a real browser (registered 2 real
pharmacies, granted the second via direct DB insert matching Team-page
work not built yet, switched between them, watched the checkmark move
and the whole app reload into the new store). 3 new backend tests, 4 new
frontend tests, all green. Full suites: frontend 394 passed; backend
isolated suite re-run 3 times (17, 6, then a clean pass) — the varying
failures are the already-diagnosed, pre-existing load-dependent flakiness
(different unrelated files each run); this change's own tests passed
clean in all three.

## STEP 1 STATUS — schema built, Sep 26, 2026

Confirmed the switcher model (Section 2) and built exactly Section 6's
Step 1, nothing more: `chains` table, `pharmacies.chain_id` (nullable),
`user_store_roles` table (migration `3bc60ce0ce95`), backfilled 1-to-1 for
every existing user (verified: 1285 users → 1285 matching rows, all
fields equal). `services/provisioning.sync_user_store_role()` is now
called from all 3 places a `User` row gets created (`POST /auth/register`,
the SSO auto-provision path, `POST /users`), so the new table stays
correct going forward, not just backfilled once. **Login/permission
checks are unchanged** — still read `users.pharmacy_id`/`role_id`
directly; nothing anywhere reads the new table yet. 2 new regression
tests (`test_user_store_roles.py`). Full backend isolated suite: 632
passed (2 failures are the already-documented, unrelated load-dependent
flakiness — confirmed in files this change never touched). Frontend: 390
passed, untouched by this step. design-guard clean.

---

## 1. WHY THIS EXISTS

Declared the primary Phase 2 focus, Sep 26, 2026, direct instruction. A pharmacy
that grows from one shop to several needs one login/dashboard for the owner
across all their stores — today PharmaCare has no concept of "more than one
store per account" at all. This doc scopes the whole thing before any code
touches it, per `docs/15_ROADMAP.md`'s own rule: "If it's Phase 2+, do NOT
build it now — no premature architecture."

This is a working plan, refined live with Abinash across several rounds —
not a finished spec. Sections marked **OPEN** still need a decision before
that piece can be built.

---

## 2. THE ONE DECISION EVERYTHING ELSE DEPENDS ON

**Checked the real code first (`backend/models/users.py`,
`routers/auth_helpers.py`), not assumed:** today, a logged-in user's identity
carries exactly **one** `pharmacy_id`, set once at login and used by every
single permission check and every tenant-scoping query in the app
(`model.pharmacy_id == current_user.pharmacy_id`, the same pattern in every
router). `Role` is also owned by exactly one pharmacy. This is the actual
reason multi-chain "touches the whole app" if done carelessly — but it
doesn't have to.

**The recommended approach keeps that one-pharmacy-per-request rule exactly
as it is today**, and only changes how a person *gets* to "my current
pharmacy_id":

- A person can be linked to **multiple stores**, each with its own role at
  that store (a new table, not a change to how `Role`/permissions work).
- At login (or via a **store switcher**, like the account switcher in Gmail),
  they pick one active store. The session/token for that request still
  carries exactly one `pharmacy_id` — identical to today.
- Every existing screen and endpoint — Billing, Purchases, GST, Inventory,
  Schedule H1, Day-End Closing, Sales/Purchase Returns — **needs zero
  changes**, because they already only ever look at "the current
  pharmacy_id," and that concept doesn't change.
- The only genuinely new things: the switcher itself, where a person's
  store-list + role-per-store gets assigned (the Team page), and new
  **rollup** screens (chain dashboard, chain reports) that deliberately look
  across more than one store — new code, not a rewrite of existing code.

**The alternative** (a single screen showing multiple stores' live data
side-by-side with no switching, one session spanning several `pharmacy_id`s
at once) is a materially bigger build — nearly every query in the app would
need to accept a *list* of pharmacy_ids instead of one. **Not recommended**
unless there's a specific reason a switcher isn't good enough.

**Recommendation: switcher-based, single active store per session.**
**OPEN — needs Abinash's confirmation before Section 4's schema work starts.**

---

## 3. HOW THIS MAPS TO WHAT WE'VE ALREADY DISCUSSED

| # | Topic | Where it lands |
|---|-------|-----------------|
| 1 | Store access | New per-(person, store) role assignment, set on the **Team page** (already merges Users + Roles today) — a second dropdown ("which store(s)") next to the existing role dropdown. Confirmed as the right shape by how Marg ERP does it: "user-wise store access," a separate setting from the functional role. |
| 2 | GST | **Not a schema problem** — checked `models/pharmacy.py`: each `Pharmacy` row already carries its *own* `gstin`/`drug_license_number`/`pan_number`. A chain is just several already-independent, already-correctly-scoped Pharmacy rows grouped under one HQ. The real open question is legal/reporting, not technical: can/should a chain roll up several stores' *separate, already-filed* GST returns into one dashboard view — never one merged return. **Still needs research — flagged, not answered.** |
| 3 | Purchases centralization | A setting, not a hardcoded flow — whether HQ places one PO that fans out, or each store still orders for itself, lives in pharmacy/chain Settings, gated by a permission the same way other settings already are. Deferred past the first build (Section 6). |
| 4 | Store-level P&L | Confirmed straightforward — Sales, Purchases, and Margin are already computed per `pharmacy_id` today; a store's P&L is just those existing numbers, no new cost-allocation logic needed. Chain-level P&L is a sum of stores' own numbers, computed the same way the existing Margin report already aggregates. |

---

## 4. SCHEMA SKETCH (not built — for review only)

- **New `chains` table**: `id`, `name`, `owner_user_id`, timestamps. One row
  per HQ account.
- **`pharmacies.chain_id`**: new nullable FK to `chains`. `NULL` = today's
  standalone single-store pharmacy, completely unaffected — **zero forced
  migration** for any existing pharmacy.
- **New `user_store_roles` table**: `user_id`, `pharmacy_id`, `role_id`,
  replacing today's direct `users.pharmacy_id` + `users.role_id` columns for
  chain members. Every *existing* user gets exactly one row here (their
  current pharmacy + role) as part of the migration, so today's single-store
  behavior is preserved exactly, not re-designed.
- **Login response** gains a store list when a person has more than one;
  otherwise behaves exactly as today (auto-selects their one store, no new
  screen shown).

---

## 5. WHAT DOES **NOT** CHANGE (the reassurance part)

Billing, Inventory/Batches, Sales & Purchase Returns, GST report, Schedule
H1 register, Day-End Closing, Audit Log — **all keep working exactly as
they do today**, scoped to one `pharmacy_id` per request, same as now. This
is deliberately not a rewrite of the core product; it's a new layer on top
of it. **Correction, same day: Customers/Suppliers moved out of this list
— see Section 8 below, found after this section was first written.**

---

## 6. SUGGESTED BUILD SEQUENCE (once Section 2 is confirmed)

1. Schema: `chains` + `user_store_roles`, migration that preserves every
   existing user's current access exactly — feature invisible until a
   second store actually exists.
2. Team page: assign a person to more than one store + a role per store;
   store switcher in the sidebar.
3. Chain-level Dashboard/reports rollups (sums of stores' existing numbers).
4. Cross-store stock transfer (a new stock-movement type between two
   `pharmacy_id`s in the same chain).
5. Purchases centralization setting (only once #3 in Section 3 is decided).
6. GST chain rollup (only once the legal research in #2 above is resolved).

---

## 7. GAPS FOUND ON A SECOND PASS, Sep 26, 2026 — none of these were in the original 4 questions

1. **Product catalog: shared or per-store?** Today `Product` is a fully
   independent table per `pharmacy_id` — two stores in the same chain
   would each re-enter the same medicine separately. For "centralized
   purchasing" to mean anything, the catalog (name/SKU/GST%) almost
   certainly needs to be **shared chain-wide**, with only stock/batches
   staying per-store. Not yet in the schema sketch — needs its own
   decision, same weight as Section 2's.
2. **Customers/Doctors: shared or per-store?** Same problem, retail-facing
   version: a customer who visits Store A and later Store B — one combined
   record (so loyalty/history/credit follow them chain-wide) or two
   separate ones? Real chains expect the combined version. **Moved out of
   "unaffected" (Section 5) — this is a real, undecided question.**
3. **Stock transfer between stores is a compliance event, not just a
   stock movement.** Moving inventory between two stores with different
   GSTINs is a "supply" under GST law even with no sale involved — it
   likely needs its own delivery challan/document, not a plain internal
   adjustment. Flagged alongside Section 3's GST rollup question, same
   "needs real research" caveat.
4. **How does a second store actually get added?** No flow exists yet for
   "turn my one pharmacy into a chain HQ and create store #2" — who's
   allowed to do it, and does the new store inherit the chain's existing
   Settings (bill header/footer, GST defaults) or start blank?

## 8. HOW REAL COMPETITORS ACTUALLY DO CENTRALIZED ORDERING/DISTRIBUTION (researched Sep 26, 2026)

Direct answer to "how does HQ decide quantity per store" — checked both
named competitors, and they represent two genuinely different models:

- **Marg ERP: manual, HQ/store-triggered.** A **Stock Transfer** ("Stock
  Issue") moves goods from one branch to another after the fact, with 3
  selectable methods: **Minimum Bases** (transfer up to the minimum
  quantity set per item), **Balance Stock** (transfer everything currently
  spare), or **Receive-Issue** (transfer items with real purchase+sale
  activity in a date range). A person decides when and how much — the
  system doesn't decide on its own. [Source](https://care.margcompusoft.com/marg-books/branch-master/183217/9/what-is-the-process-of-multi-branch-pharmacy-retail-chain-management-in-marg-books), [Source](https://care.margcompusoft.com/margerp/stock-issue/1669/1/How-to-transfer-stock-from)
- **eVitalRx: automatic, demand-driven.** Named as "**inter-branch stock
  auto reallocation**" — the system itself moves stock toward whichever
  branch has real demand, in real time, without someone manually deciding
  a split. [Source](https://www.evitalrx.in/pharmacy-types/pharmacy-chain/)

**This is a real decision we haven't made**, on top of the "does HQ place
one order at all" question already flagged: start with Marg's simpler,
human-decided model (a person picks quantity per store when creating the
order or transferring stock) — eVitalRx's automatic version is real but a
meaningfully bigger, smarter build, worth revisiting only once the manual
version is working and actually used.

## 9. OPEN ITEMS BEFORE ANY BUILD STARTS

- [ ] Confirm switcher-based, single-active-store-per-session (Section 2).
- [ ] GST rollup — legal/CA research on what a chain is actually allowed to
      show/file as one view vs. per-store.
- [ ] Purchases centralization — decide default (per-store vs. HQ-fanout)
      before building the setting, not required for Sections 1-2.
- [ ] Product catalog shared vs. per-store (Section 7.1).
- [ ] Customers/Doctors shared vs. per-store (Section 7.2).
- [ ] Cross-store stock transfer's GST/delivery-challan requirement
      (Section 7.3) — same "needs research" bucket as the GST rollup item.
- [ ] New-store onboarding flow — who can add one, what it inherits
      (Section 7.4).
- [ ] Manual (Marg-style, person picks quantity per store) vs. automatic
      (eVitalRx-style, system reallocates by demand) distribution model
      (Section 8) — recommend starting manual.
