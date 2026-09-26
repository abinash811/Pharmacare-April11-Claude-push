# PharmaCare — Multi-Chain Scope Document
# Version: 1.0 | Last updated: September 26, 2026
# Type: Explanation
# Status: 🚫 Scoping only — nothing built, no schema changed. Do not build from this without a separate go-ahead per section.

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

Billing, Purchases, Inventory/Batches, Sales & Purchase Returns, GST report,
Schedule H1 register, Day-End Closing, Customers, Suppliers, Audit Log —
**all keep working exactly as they do today**, scoped to one `pharmacy_id`
per request, same as now. This is deliberately not a rewrite of the core
product; it's a new layer on top of it.

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

## 7. OPEN ITEMS BEFORE ANY BUILD STARTS

- [ ] Confirm switcher-based, single-active-store-per-session (Section 2).
- [ ] GST rollup — legal/CA research on what a chain is actually allowed to
      show/file as one view vs. per-store.
- [ ] Purchases centralization — decide default (per-store vs. HQ-fanout)
      before building the setting, not required for Sections 1-2.
