# PHARMACARE — QUICK CONTEXT
# Read this first in any new session
# Last updated: April 18, 2026

---

## WHAT IS THIS PROJECT
PharmaCare is an Indian pharmacy management SaaS product.
Built for single-store pharmacies today, scaling to chains and hospitals tomorrow.
Target: All pharmacies across India.

## FOUNDER
Non-technical CEO/founder. Building with Claude Code + Claude.ai.
Needs plain English explanations. No jargon without explanation.

## CURRENT BRANCH
`main` — listing pages and backend work
`claude/compassionate-agnesi` — design consistency fixes (active)

## TECH STACK
- Frontend: React + Tailwind CSS + Shadcn/UI (JavaScript, converting to TypeScript)
- Backend: Python FastAPI + SQLAlchemy 2.0 async + PostgreSQL
- ORM: SQLAlchemy 2.0 async
- Auth: JWT

## ACTIVE BACKEND (PostgreSQL — port 8000)
The PostgreSQL routers (`backend/routers/*` + `backend/main.py`) are the active backend.
Start with: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
Frontend `.env.local` → `REACT_APP_BACKEND_URL=http://localhost:8000`

## LEGACY BACKUP (MongoDB — DO NOT START)
`backend/server.py` is the original MongoDB backend — kept as rollback reference only.
It has a prominent warning comment at the top. Do not run it. Do not delete it.
If needed for rollback: `uvicorn server:app --host 0.0.0.0 --port 8001 --reload`

## WHAT WE ARE DOING
Full refactor to international engineering standard:
1. ✅ PostgreSQL schema (21 tables) — DONE
2. ✅ Split server.py into 14 router files — DONE
3. ✅ Migrate MongoDB queries → PostgreSQL in each router — 15/15 COMPLETE
4. ✅ Frontend constants + utils + hooks — DONE
5. ✅ TypeScript conversion — DONE
6. ✅ Break down giant files — DONE (9 files → 73 focused files, all ≤300 lines)
7. ✅ Fix broken pages — DONE
8. ✅ Add missing features (pagination, barcode, print) — DONE
9. ✅ Design consistency fixes — COMPLETE

## CRITICAL RULES
- One task at a time. Review before next task.
- No file over 300 lines
- Never delete server.py (kept as backup)
- Always commit after each completed task
- Money = INTEGER paise (₹1 = 100 paise). Never floats.
- Steel Blue #4682B4 is the ONLY primary color. Never teal.
- PHARMACARE_DESIGN_SKILL.md is the single design reference. Read it before any frontend work.
- Soft deletes only — never hard delete pharmacy data
- Snapshot product details in bills — never reference live product name
- Shadcn/UI exclusively — no other component libraries

## WHAT IS WORKING NOW
All features are complete and fully polished. Design consistency phase is done.

- ✅ All billing, purchases, inventory, returns, suppliers, customers features
- ✅ Dashboard, reports, GST report, compliance, audit log, stock movement log
- ✅ Consistent PageHeader on all listing pages
- ✅ BillingWorkspace — labeled-column subbar, action buttons in header
- ✅ PurchaseNew — labeled-column subbar, action buttons in header
- ✅ Design tokens (brand, brand-dark, brand-tint, brand-subtle) in tailwind.config.js
- ✅ Rounds 1–4 design violations fixed (colors, badges, modals, row hover)
- ✅ All custom modals → Shadcn Dialog (13 files)
- ✅ ESLint + pre-commit hook enforcing design rules

## NEXT TASK
App is complete. Consider: code splitting (bundle 570KB), e2e tests, or mobile polish.

## DESIGN COMMITS (April 18, 2026)
- `6b0be71` — Round 3: all custom modals → Shadcn Dialog
- `7738a9b` — Design enforcement: tokens, mass fix, lint, pre-commit hook
- `9af376b` — Page header white bar + billing search row at top
- `f2052b8` — Billing & Purchase workspace redesign (labeled subbars, header CTAs)
- prev session — PageHeader consistency (Dashboard, Reports, Suppliers)

## PHASE 6 COMMITS (ALL COMPLETE)
1. `e0ea0a3` — BillingWorkspace (2,054 → 12 files)
2. `5ae85cf` — InventorySearch (1,591 → 11 files)
3. `a387a9e` — PurchaseNew (1,231 → 9 files)
4. `bc36c17` — MedicineDetail (1,108 → 8 files)
5. `aeefb9b` — Customers (771 → 7 files)
6. `9646f24` — Suppliers (747 → 6 files)
7. `4e6d2a6` — Dashboard (519 → 7 files)
8. `4302e18` — Settings (666 → 8 files)
9. `286e982` — Reports (509 → 5 files)

## FILES TO READ FOR FULL CONTEXT
1. CLAUDE.md — complete engineering reference
2. PROGRESS.md — detailed task tracking
3. DECISIONS.md — every decision and why
4. PHARMACARE_RULES.md — design system rules
5. PHARMACARE_DATABASE_SCHEMA.md — complete database design

## SAFE CHECKPOINTS (git commits)
1. "PostgreSQL models complete, server.py untouched"
2. "Phase 2 complete: backend split into router files"
3. Phase 3 commits — all 15 routers migrated (final: `224915d`)
4. Phase 4 complete — constants, utils, hooks (final: `4c07824`)
5. Phase 5 complete — TypeScript added (final: `f90d271`)
6. Phase 6 complete — all giant files broken down (final: `286e982`)
