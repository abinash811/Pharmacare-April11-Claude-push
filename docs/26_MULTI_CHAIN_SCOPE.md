# PharmaCare — Multi-Chain Scope Document
# Version: 1.14 | Last updated: September 28, 2026
# Type: Explanation
# Status: ✅ All 6 items of Section 6's original build sequence are built on branch `phase-2-multi-chain-pharmacy`, plus a Step 5b compliance fix (stock transfer now blocked between stores with different GSTINs), a Sep 28 security fix on Steps 4/6b (scope=chain no longer leaks other branches' data past a real access grant), and 3 Sep 28 persona-audit follow-ons (settings inherit on Add Store, Reports chain-scope boundary note, Transfer history + Reverse UI) — see below. Remaining open items are all follow-on scope, not part of the original sequence — see Section 9.

## STEP 4/6b SECURITY FIX — chain-scope now checks real store access, Sep 28, 2026

A fresh cross-persona (pharmacist/admin/owner) audit of this whole finished
feature — run on direct request, not part of the original build sequence —
found that Steps 4 and 6b's `?scope=chain` toggle (Dashboard, Purchases
analytics, GST report) summed **every** pharmacy sharing the caller's
`chain_id`, full stop. It never checked `user_store_roles`. A team member
granted access to only some of a chain's stores could still see every
other branch's revenue/GST/purchase totals under `scope=chain` — the exact
class of bug Step 6's `resolve_store_override`/`resolve_store_override_for_write`
were built to prevent for writes, never applied to this read-rollup path.

Fixed by a new canonical `resolve_chain_scope_pids(current_user, scope, db)`
in `routers/auth_helpers.py`, replacing the inline, ungated version that
used to live in `reports.py` — it now intersects chain membership with the
caller's real grants. 2 new regression tests, each confirmed to fail
against the pre-fix code via `git stash`. A new automated gate
(`scripts/check_chain_scope_safety.py`, `design-guard.sh` Rule 21) now
blocks any future raw `.chain_id` query outside this helper — confirmed it
would have caught the original bug by running it against the pre-fix code.
Full detail, including the process fix (CLAUDE.md rule 11 addendum: a
multi-step feature's last step is a fresh persona audit, not just that
step's own tests) in `docs/15_ROADMAP.md`'s RULE MISSES LOG, Sep 28, 2026.

**Also found by the same audit — all 3 fixed same day, Sep 28, 2026:**
- **§7 #4 (settings not carried over) resolved, not just warned about.**
  `create_pharmacy_with_defaults` (`services/provisioning.py`) now accepts
  an optional `source_settings` and copies every `PharmacySettings` field
  from it except `bill_sequence_number`/`return_sequence_number` (GST
  requires each store's own gapless series, never inherited). `chains.py`'s
  `create_chain_store` passes the caller's own current settings. The "Add
  Store" dialog also tells the admin this up front. Live-verified end-to-end
  (not just pytest): set `near_expiry_days` to 77 on a real store via the
  real API, added a third store, confirmed its `GET /settings` showed 77
  while `bill_sequence_number` stayed at 1.
- **Reports chain-scope boundary now visible.** `Reports/index.jsx` shows
  "Showing your active store only — chain-wide view isn't available for
  these reports yet (Dashboard and GST Report have it)" whenever the
  account has more than one store — gated the same way the Dashboard/GST
  toggles already are, so it stays invisible for the common single-store
  case. Deliberately NOT a chain-scope build for the other 12 report
  types — that would be its own project comparable in size to Steps 4/6b,
  not a small follow-on.
- **Transfer history + Reverse now has a frontend.** New `Transfers` tab
  on Inventory (`TransferHistory.tsx`, `/inventory/transfers`) — lists
  every transfer via `GET /stock-transfers` (already existed, already
  correctly scoped to the caller's own pharmacy on either side) with an
  admin-only Reverse action wired to `POST /stock-transfers/{id}/reverse`
  (also already existed, already tested — only the UI was missing).
  Live-verified: created a real transfer via the API, saw it appear with
  the right direction/status, clicked Reverse in the browser, watched the
  status flip to "Reversed" and the button disappear.

New/updated tests: 1 backend (`test_chain_store_management.py`), 3
frontend suites (`StoresTab.test.tsx` addition, `Reports/__tests__/index.test.tsx`
new, `__tests__/TransferHistory.test.tsx` new — 6 cases). Full suites green
(frontend 424/424; backend 658 passed, non-deterministic pre-existing
flakiness on a subset confirmed via repeated isolated reruns, none in
touched files), `tsc`/flake8/`design-guard.sh` all clean.

**Also found live during this verification, unrelated to multi-chain,
not fixed here:** the Settings page's "Near Expiry Alert" field doesn't
actually send its value when saved through the UI form — confirmed via
direct API call that `PUT /settings` itself round-trips correctly, so this
is a pre-existing frontend bug isolated to that one control, flagged
separately rather than fixed as part of this change.

## STEP 6b STATUS — GST report chain-wide rollup built, Sep 27, 2026

Same design basis as Step 4's Dashboard rollup, extended to a second
report on direct instruction. Researched real products again before
building ("how does other products does this"): confirmed neither Marg
nor eVitalRx (nor Pharmasoft, which has no public documentation on this
at all) ever merges two different GSTINs' actual filed returns — GST law
requires each GSTIN to file separately, always. What multi-branch
software actually offers there is a read-only combined view stacking
each GSTIN's own numbers — never a real merged filing. That confirmed
the design: `GET /reports/gst` gained the same `?scope=store|chain`
toggle Step 4 already established, reusing that step's own
`_resolve_dashboard_scope_pids` helper — renamed to the scope-neutral
`_resolve_chain_scope_pids` since it's now shared by two different
reports, not Dashboard-only. All five of the report's query blocks
(sales, sales returns, purchases, purchase returns, cess) switched from
`pharmacy_id == pid` to `pharmacy_id.in_(pids)`. Response now also
returns `scope`/`store_count`, same as Step 4.

**Real risk flagged and handled, not left implicit**: a combined "All
Stores" GST view could be mistaken for one store's actual filing figures
by whoever downloads it. Fixed by labeling both surfaces that leave the
screen or could be read without full context — the on-screen summary
card shows "Combined across N stores — each store still files its own
GSTIN return separately; this total is for your own visibility only"
whenever chain scope is active, and the CSV export both gets a leading
disclaimer line and an `_all_stores` filename suffix when exported in
chain scope.

Frontend: same `FilterPills` "This Store"/"All Stores" toggle pattern as
Dashboard, gated on `GET /pharmacies/stores` returning more than one
store. `GSTReport.js` extracted its two near-identical rate-bucketed
tables into a new shared `GSTReportTable.tsx` component to stay under
the 300-line cap once the toggle was added — the Sales/Purchases GST
tables are now one parameterized component, not two copies.

4 new backend tests (`test_gst_report_chain_scope.py`) covering
standalone-unchanged, default-store-only, chain-sums-every-store (sales
and purchases sides both), 2 new frontend tests (toggle hidden for
single-store, toggle shown + refetches with scope=chain + disclaimer
appears on click); `npx tsc --noEmit` and `design-guard.sh` both clean.

Live-verified end-to-end in a real browser: registered a fresh two-store
admin, created a ₹24 GST bill history at the home store and a ₹18 GST
bill at a second store (session stayed active at home throughout),
generated the GST report — "This Store" correctly showed ₹24, clicking
"All Stores" instantly refetched and showed ₹42 with the disclaimer
text, and toggling back to "This Store" correctly reverted to ₹24 with
the disclaimer gone. Full suites: backend isolated and frontend suites
both re-run clean after this change — see the commit for exact counts.

**Explicitly NOT solved by this step** (documented, not silently
assumed): every store in the chain is assumed to hold its own separate
GSTIN. If two stores in a future chain ever share one GSTIN, this
display-only sum would be the wrong model for that pair — see the new
Section 7.5/9 item below for what that would actually require.

## STEP 6 STATUS — HQ-buyer purchase picker built, Sep 27, 2026

Researched real-world precedent before building, direct instruction
("how does this work in real, how does other products solve this"):
confirmed via web research that neither Marg nor eVitalRx auto-splits one
PO across stores — both rely on per-store ordering plus centralized
visibility and stock transfer (already built in Step 5), and GST filing
cannot combine different GSTINs into one return regardless. The
concrete simplification real ERPs (Odoo) use for "HQ places an order for
a store they aren't currently in" is a **store selector directly on the
transaction screen itself**, not a full account/session switch — that
became this step's design.

Added a STORE column to the New Purchase screen's subbar, shown only
when the caller has `user_store_roles` access to more than one store
(invisible for the common single-store case). Picking a different store
there lets an HQ-authorized person place a purchase order — and, if
needed, create the distributor for it — at that store, without leaving
their own active session or switching stores first.

**Permission architecture** — two new shared helpers in
`backend/routers/auth_helpers.py`:
- `resolve_store_override(current_user, requested_pharmacy_id, db)` — for
  READ endpoints (`GET /suppliers`, `GET /products`). No override →
  caller's own store, unchanged. Override → requires a real
  `user_store_roles` grant at the target (403 otherwise); no specific
  permission required, since listing is read-only and low-risk.
- `resolve_store_override_for_write(current_user, requested_pharmacy_id,
  required_permission, db)` — for WRITE endpoints (`POST /purchases`,
  `POST /suppliers`). Requires the caller to actually hold
  `required_permission` (e.g. `purchases:create`) — via their own
  current role when there's no override, or via their granted role AT
  THE TARGET STORE when there is one. **Caught and fixed before shipping:**
  an earlier draft's "no override" branch returned the caller's own
  `pharmacy_id` with no permission check at all, which would have let
  any authenticated user (a cashier with no `purchases:create`/
  `suppliers:create` anywhere) create a purchase or supplier at their
  own store simply by omitting `pharmacy_id` — a silent bypass of the
  existing permission gate. Fixed by re-checking permission explicitly
  in that branch too; guarded going forward by a dedicated regression
  test (`test_own_store_purchase_still_requires_permission_when_no_override_given`
  and its supplier-create equivalent).

**Two more real gaps found only by live-testing, not assumed fixed:**
1. `GET /suppliers` and `GET /products` were still scoped to the
   caller's *active session* store, not the picker's *target* store —
   the Distributor dropdown and medicine search showed the wrong
   store's data. Fixed by wiring `resolve_store_override` into both.
2. The inline "+ Add new distributor" flow inside `SupplierDropdown`
   created the new supplier at the *active* store too. Fixed via
   `resolve_store_override_for_write` on `POST /suppliers` plus a
   `pharmacy_id` field threaded through from the frontend.

`scripts/check_permission_coverage.py` (Rule 15) flagged
`create_purchase`/`create_supplier` as unguarded once their permission
check moved inside the new shared helper — correctly extended the
checker's own `PERMISSION_CALL_NAMES` set to recognize
`resolve_store_override_for_write`, rather than mislabeling either
endpoint exempt (they are not — they genuinely check permission, just
inside a helper).

8 new backend tests (`test_purchase_hq_picker.py`,
`test_hq_store_override_read.py`) plus 5 new frontend tests
(`useHQStorePicker.test.js`, `buildPurchasePayload.test.js` additions);
`npx tsc --noEmit` and `design-guard.sh` both clean.

Live-verified end-to-end in a real browser: as an HQ admin whose active
session stayed at "Live Transfer Pharmacy," selected "Live Transfer
Second Store" via the STORE picker, created a brand-new distributor
("Verified Second Store Distributor") and confirmed via API it landed
at Second Store (not Home), added a product, and confirmed the
purchase. The saved purchase row's `pharmacy_id` in the database is
Second Store's — `PUR-2026-0001`, ₹21.00, status `confirmed` — proving
the whole picker flow (store selection → distributor scoping → product
scoping → the actual write) lands at the target store while the
session never left Home.

## STEP 5b STATUS — stock transfer blocked between different-GSTIN stores, Sep 27, 2026

Direct instruction after a real compliance risk surfaced in conversation
("evitals doesn't allow stock transfer if pharmacies have different Gst
numbers, they need a B2B license" → "we just allow accounts who have
same GSTIn do transfer. And block different GSTs... Simple"). Confirmed
via research before building: moving stock between two different-GSTIN
stores is a taxable "supply" under GST law (they're legally distinct
"persons" under CGST Act Section 25) requiring its own tax invoice, and
typically a Wholesale Drug License — a retail drug license only covers
selling to end patients, not supplying another business. This app
generates neither. Step 5's original build only computed `is_cross_gstin`
for **display** — a real, already-shipped gap where a pharmacist could
transfer stock across GSTINs with zero warning, zero license check, zero
document.

Fixed by blocking rather than building the document/license flow:
`POST /stock-transfers` now requires both stores' GSTIN to be set AND
identical before allowing any transfer — a missing GSTIN on either side
is rejected too ("not proven different" isn't "confirmed same"), not
silently treated as safe. `is_cross_gstin` stays on the model for
transfers made before this change; no new transfer can ever set it
`True` since the create endpoint blocks that case before it can happen.

Also added `gstin` to `GET /users/me/stores`' response (previously
`pharmacy_id`/`pharmacy_name`/`role_name`/`is_active` only) so
`TransferStockModal.tsx` can filter the destination picker down to only
GSTIN-matching stores up front — nobody fills in a whole transfer just
to be rejected at submit. Missing own-GSTIN and no-matching-store both
get their own clear message rather than an empty, unexplained dropdown.

9 backend tests updated/added in `test_stock_transfers.py` (existing
happy-path tests now explicitly set matching GSTINs via a new
`_add_second_store_same_gstin()` helper; the old
`test_cross_gstin_is_detected_when_gstins_differ` — which expected
success — rewritten as `test_rejected_when_gstins_differ`; new
`test_rejected_when_either_store_is_missing_a_gstin`), 2 new frontend
tests (destination hidden for a GSTIN mismatch, own-GSTIN-missing
message shown). `npx tsc --noEmit` and `design-guard.sh` both clean.

Live-verified end-to-end in a real browser across all three states: (1)
neither store has a GSTIN set → modal shows "Set this store's GSTIN
under Settings first"; (2) stores have different GSTINs → modal shows
"No other store in your chain shares this store's GSTIN"; (3) GSTINs
set equal on both stores → destination appears normally, transfer of 10
units completed successfully, source stock correctly dropped from 100
to 90.

## STEP 5 STATUS — cross-store stock transfer built, Sep 26, 2026

Confirmed the design first, direct instruction: Marg ERP's manual,
human-decided model (not eVitalRx's automatic demand-driven
reallocation — bigger, smarter build, revisit only once manual is
working and used). Real gaps worked through before building: in-transit
state (v1: instant, no holding state — confirmed), GST paperwork
(delivery challan vs. tax invoice — classified automatically from the
two stores' GSTINs, but this app does **not** generate the actual
challan/tax-invoice/e-way-bill document itself, that's separate, bigger
scope), batch integrity (exact batch/cost/MRP/expiry preserved),
concurrency (handled by the instant model — nothing sits half-moved),
reversal (only if the destination hasn't already sold/used that stock),
reporting (never counted as a sale/purchase anywhere), and drug license
(checked only at sale time, same as today — not re-checked at transfer
time, confirmed).

New tables `stock_transfers` (header) + `stock_transfer_items` (lines,
migration `e3511cb2db2b`). `POST /stock-transfers`: admin-only, moves
real stock instantly between two stores in the same chain — destination
product is auto-created if that SKU doesn't exist there yet (products
are stored separately per store, not shared), destination batch matches
by batch number (creates one if new, tops up if it already exists).
Rejects if not enough stock, if the destination isn't in the same chain,
or if a non-admin tries. `is_cross_gstin` is computed automatically by
comparing the two stores' GSTINs — display-only classification, no
document generated. `POST /stock-transfers/{id}/reverse`: rejects if
already reversed, or if the destination batch's on-hand quantity is
less than what this transfer added (some of it has already been
sold/used). Every create and reversal writes an audit-log entry on
**both** the source and destination pharmacy's own audit trail (direct
instruction — verified live: `stock_transfer_out` on source,
`stock_transfer_in` on destination, both showing the same transfer
number, items, and store names).

Frontend: reuses Inventory's existing bulk-select pattern (checkboxes +
an always-visible action bar — direct instruction: "button should be
upright visible", not hidden in a menu) — a "Transfer Stock" button
next to "Bulk Update". `TransferStockModal.tsx` defaults each product to
its earliest-expiring batch with stock (FEFO), never pre-fills a
quantity (a deliberate entry every time), and only lists other stores in
the caller's own chain as destinations (excludes the currently-active
store). 10 new backend tests, 4 new frontend tests, all green; tsc +
design-guard clean.

Full suites: backend isolated suite 658/658 passed (fully clean run,
zero pre-existing flakiness this time); frontend suite 406/406 passed
(84/84 suites). Live-verified end-to-end in a real
browser: registered a fresh admin, added a product with 100 units,
added a second store, selected the product on the Inventory page,
clicked the always-visible "Transfer Stock" button, sent 25 units —
source dropped to 75, destination auto-created the product and showed
25 units on the very next page load, and both pharmacies' own audit
logs showed the matching `stock_transfer_out`/`stock_transfer_in`
entries with the same transfer number.

## STEP 4 STATUS — Dashboard chain-wide rollup built, Sep 26, 2026

Scoped down first, on direct instruction: only the main Dashboard page
(not the whole Reports section) gets chain rollups, and it defaults to
per-store with an explicit toggle to combined — zero behavior change for
anyone who never adds a second store. `GET /analytics/dashboard` and
`GET /analytics/purchases` (the Dashboard's Purchases summary card) both
take an optional `?scope=store|chain` (default `store`, unchanged). When
`scope=chain`, every summable number (bill totals, stock counts/value,
low-stock/expiry counts, purchases/purchase-returns) sums across every
pharmacy in the caller's chain via `pharmacy_id.in_(pids)` instead of a
single `== pid`; single-pharmacy config (`PharmacySettings` thresholds,
drug license expiry) always stays on the caller's own home store — those
aren't sums, they're settings. Response includes `scope` and
`store_count` so the frontend never has to guess what it got back. A
standalone (non-chain) pharmacy gets `pids = [own_id]` either way — truly
identical output whether or not the toggle exists for them.

Frontend: a `FilterPills` toggle ("This Store" / "All Stores") in the
Dashboard's `PageHeader` actions, gated on `GET /pharmacies/stores`
returning more than one store (hidden entirely for everyone else — no
dead UI for the common case). Defaults to `REPORT_SCOPE.STORE`
(`constants/domainConstants.js`, no magic strings). 4 new backend tests
(`test_dashboard_chain_scope.py` — standalone-unchanged, default-is-
store-only, chain-sums-every-store, purchases-analytics-chain-scope),
2 new frontend tests (toggle hidden for single-store, toggle shown +
refetches with `scope=chain` on click); `npx tsc --noEmit` and
`design-guard.sh` both clean.

Full suites: frontend 402/402 passed. Backend isolated suite: this
change's own new test file passed clean on 3 separate isolated reruns;
a full-suite run showed 26 scattered failures (all traced to the same
already-diagnosed "register/create → immediate authenticated call"
read-after-write flakiness this session already found and reported —
confirmed by reading the actual tracebacks: every one is a `401 User not
found` or `404 Product not found` immediately after creating that exact
row, not an assertion on this endpoint's numbers) plus this file's own 4
tests re-appearing as errors in that same run for the identical reason —
none of it reproduces the actual Dashboard rollup logic being wrong.

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

1. **Product catalog: shared or per-store? Sourcing decided Sep 28,
   2026 — reframes this beyond just multi-chain.** Today `Product` is a
   fully independent table per `pharmacy_id` — two stores in the same
   chain would each re-enter the same medicine separately. Researched
   how real competitors do this first (Sep 27, 2026): Marg, eVitalRx,
   and Pharmasoft **unanimously** ship one shared master catalog
   (medicine identity: name, composition/salt, HSN, dosage form,
   sometimes images) with only stock/inventory kept per-branch —
   eVitalRx names theirs explicitly ("400,000+ medicines... centralized
   product catalog"). Marg's wording ("customize Price Lists" per
   branch) flags a real sub-question: pricing/MRP likely needs to stay
   per-store overridable even on top of a shared catalog, not locked
   identical everywhere.
   **Direct instruction, Sep 28, 2026: the real medicine database will
   be provided by Eka** (see `docs/13_DEPLOYMENT.md`'s pre-launch
   blocker #8, updated same day) — count/field-coverage/delivery format
   not yet known, to be confirmed before designing the import. This
   makes the catalog naturally **platform-wide**, not just chain-scoped
   — every PharmaCare pharmacy (chain or standalone) would search the
   same real Eka-sourced list, with per-store manual entry becoming the
   fallback for genuinely novel/local items rather than the default
   path.
   **Scope confirmed same day, direct instruction: identity only —
   medicine name, generic name, strength (mg/ml), and similar —
   explicitly NOT pricing.** This actually answers Marg's pricing
   sub-question above, cleanly: MRP/cost/PTR/discount%/reorder-level
   were never going to be in Eka's shared data at all, so they stay
   per-store entries unconditionally — not "shared then overridden,"
   just never shared. **Still open once Eka's exact data is in hand:**
   the full field list beyond name/generic/strength (composition/salt?
   HSN? GST%? dosage form? manufacturer? schedule classification?),
   record count, delivery format, and whether/how this interacts with
   the chain-scoped `Product` question above for a chain's own
   store-to-store view.
2. **Customers/Doctors: shared or per-store?** Same problem, retail-facing
   version: a customer who visits Store A and later Store B — one combined
   record (so loyalty/history/credit follow them chain-wide) or two
   separate ones? Real chains expect the combined version. **Moved out of
   "unaffected" (Section 5) — this is a real, undecided question.**
3. **RESOLVED Sep 27, 2026 (Step 5b) — stock transfer between stores with
   different GSTINs is now blocked outright, not built for.** Confirmed
   via research (both the general GST-law rule and a real competitor,
   eVitalRx, which blocks this exact case and requires a Wholesale Drug
   License instead): moving inventory between two different-GSTIN stores
   is a taxable "supply" needing its own tax invoice and typically a
   Wholesale Drug License — neither of which this app generates or
   verifies. Direct instruction: rather than build that, `POST
   /stock-transfers` now requires both stores' GSTIN to be set AND equal
   before allowing a transfer at all; a missing GSTIN on either side is
   rejected too ("not proven different" isn't "confirmed same"). See
   STEP 5b STATUS below.
4. **RESOLVED Sep 28, 2026 — new store now inherits Settings, not blank.**
   Built Step 3 (Settings → Stores tab, admin-only, creator auto-granted).
   The settings-inheritance half was left blank on purpose then, logged
   open here, and shipped past without resolving — caught by the Sep 28
   persona audit. Fixed same day: `create_pharmacy_with_defaults` copies
   the caller's current `PharmacySettings` onto the new store (branding,
   GST defaults, thresholds, print/receipt prefs), excluding
   `bill_sequence_number`/`return_sequence_number`, which always start
   fresh per store as GST requires. See the STEP 4/6b SECURITY FIX section
   above for the live-verified detail.
5. **Two stores sharing one GSTIN — not built, and not a small follow-on
   to Step 6b's rollup.** Added Sep 27, 2026, direct question before
   approving Step 6b's build ("if we get a pharmacy that has same GSTIN
   for two pharmacies... shouldn't be small"). Confirmed: it isn't small.
   Every mutating flow (Billing, Purchases, Sales/Purchase Returns) numbers
   its documents independently per `pharmacy_id` today, which is only safe
   because every store has always had its own GSTIN. Two stores sharing one
   GSTIN would make that numbering collide (both could generate "INV-0001"
   under the same tax ID) — a real compliance problem, not cosmetic.
   Researched how Marg actually solves this (the only one of the three
   named competitors with a documented answer, Sep 27, 2026): a "Multi
   Series" setting lets each branch use a distinct invoice-number
   prefix/series while still sharing one GSTIN, so numbers never collide
   even though it's legally one taxpayer — GST rules explicitly permit
   different series per branch under one GSTIN. eVitalRx and Pharmasoft
   have no public documentation on this case at all. **The user's own
   proposed shape is right** — detect the GSTIN match when a store is
   added to a chain and require a distinct series before allowing it,
   never silently — but it is real plumbing across four numbering
   systems (Billing, Purchases, Sales Returns, Purchase Returns) plus a
   uniqueness validation rule, not a single prompt. It also only fixes
   the numbering collision — it does **not** by itself produce a real
   combined filing-ready register for that shared GSTIN (a second,
   separate piece, easier once numbers can't collide). **Not built. Build
   only if a real chain with this shape appears** — same "needs its own
   decision" weight as items 1-2 above, not assumed away.

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

## 9. OPEN ITEMS

> Re-swept Sep 27, 2026 — several items below were resolved by Steps 2-6b
> and are marked done rather than left stale. Genuinely open items remain
> unchecked.

- [x] Confirm switcher-based, single-active-store-per-session (Section 2)
      — built Step 2.
- [x] GST rollup — resolved as a display-only sum of each store's own
      already-separately-filed numbers (Step 6b); legal research
      confirmed different GSTINs can never file as one return regardless
      of software, so there was no "show as one filing" option to choose.
- [x] Purchases centralization — resolved as the HQ-buyer store picker on
      the transaction screen itself (Step 6), matching Odoo's real-world
      pattern; not a one-PO-fans-out-to-many-stores model (confirmed no
      major competitor does that either).
- [x] New-store onboarding flow — built Step 3 (Settings → Stores tab,
      creator auto-granted admin, Team-page grant/revoke for others).
      Settings-inheritance half resolved Sep 28, 2026 (Section 7 #4).
- [x] Cross-store stock transfer's different-GSTIN risk (Section 7.3) —
      resolved Step 5b by blocking the transfer outright rather than
      building the document/license flow. Confirmed via research this
      matches how eVitalRx actually handles it.
- [ ] Product catalog shared vs. per-store (Section 7.1) — sourcing AND
      scope decided Sep 28, 2026 (Eka will provide the real medicine
      database, identity fields only — name/generic name/strength, no
      pricing — so commercial fields stay per-store unconditionally).
      Full field list beyond name/generic/strength, record count, and
      delivery format still unknown; confirm before designing the
      import.
- [ ] Customers/Doctors shared vs. per-store (Section 7.2) — laid out
      Sep 27, 2026 (real cross-cutting surface confirmed: billing.py,
      customers.py, reports.py, plus the phone-number dedup question),
      not yet built.
- [ ] Manual (Marg-style, person picks quantity per store) vs. automatic
      (eVitalRx-style, system reallocates by demand) distribution model
      (Section 8) — recommend starting manual; Step 5's stock transfer
      already built the manual version.
- [ ] Two stores sharing one GSTIN (Section 7.5, added Sep 27, 2026;
      explicitly on hold Sep 27, 2026) — per-branch invoice-series
      support across Billing/Purchases/Returns, plus the actual combined
      filing register. Not built; build only if a real chain with this
      shape appears.
