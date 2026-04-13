# PHARMACARE — QUICK CONTEXT
# Read this first in any new session
# Last updated: April 13, 2026

---

## WHAT IS THIS PROJECT
PharmaCare is an Indian pharmacy management SaaS product.
Built for single-store pharmacies today, scaling to chains and hospitals tomorrow.
Target: All pharmacies across India.

## FOUNDER
Non-technical CEO/founder. Building with Claude Code + Claude.ai.
Needs plain English explanations. No jargon without explanation.

## CURRENT BRANCH
`claude/compassionate-agnesi` ← all refactor work happening here
`main` ← original working code, UNTOUCHED, safe to return to

## TECH STACK
- Frontend: React + Tailwind CSS + Shadcn/UI (JavaScript, converting to TypeScript)
- Backend: Python FastAPI
- Database: PostgreSQL (migrating FROM MongoDB)
- ORM: SQLAlchemy 2.0 async
- Auth: JWT

## WHAT WORKS RIGHT NOW
The original `server.py` (MongoDB) is the running backend — all features work.
The NEW PostgreSQL routers (`backend/routers/*` + `backend/utils/excel.py`) are fully migrated (15/15).
Next step: integration test the new routers, then switch `main.py` to use them instead of server.py.

## WHAT WE ARE DOING
Full refactor to international engineering standard:
1. ✅ PostgreSQL schema (21 tables) — DONE
2. ✅ Split server.py into 14 router files — DONE (structure only)
3. ✅ Migrate MongoDB queries → PostgreSQL in each router — 15/15 COMPLETE
4. ⏳ Frontend constants + utils + hooks
5. ⏳ TypeScript conversion
6. ⏳ Break down giant files (BillingWorkspace 2054 lines, etc.)
7. ⏳ Fix broken pages (Dashboard, Reports, GSTReport)
8. ⏳ Add missing features (pagination, barcode, print)

## CRITICAL RULES
- One task at a time. Review before next task.
- No file over 300 lines
- Never delete server.py until ALL routers are migrated and tested
- Always commit after each completed task
- Money = INTEGER paise (₹1 = 100 paise). Never floats.
- Steel Blue #4682B4 is the ONLY primary color. Never teal.
- Customers.js is the design reference. Every page matches it.
- Soft deletes only — never hard delete pharmacy data
- Snapshot product details in bills — never reference live product name

## NEXT TASK
Phase 4 — Frontend constants, utils, hooks

## PHASE 3 COMMITS (ALL COMPLETE)
1. `62b9200` — auth layer migrated (deps, auth_helpers, auth)
2. `9ab2fc6` — users and settings migrated
3. `1d983a5` — customers and suppliers migrated
4. `eeef0f6` — inventory and batches migrated
5. `6e0eb99` — purchases and purchase_returns migrated
6. `eb3d680` — sales_returns migrated
7. `d2131b3` — billing migrated
8. `e20f1dd` — reports migrated
9. `224915d` — excel bulk upload migrated

## FILES TO READ FOR FULL CONTEXT
1. CLAUDE.md — complete engineering reference
2. PROGRESS.md — detailed task tracking
3. DECISIONS.md — every decision and why
4. PHARMACARE_RULES.md — design system rules
5. PHARMACARE_DATABASE_SCHEMA.md — complete database design

## SAFE CHECKPOINTS (git commits)
1. "PostgreSQL models complete, server.py untouched"
2. "Phase 2 complete: backend split into router files"
3. Phase 3 commits (see above) — all 15 routers migrated
