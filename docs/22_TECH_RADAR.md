# PharmaCare — Tech Radar
# Last updated: August 2026
# Audience: Claude, Abinash, future developers
# Purpose: What's modern/efficient (cost + performance) for each layer of the stack,
#          sourced from real external references — not guessed, not vibes.
# Rule: Re-check this every 6 months (Thoughtworks Radar updates twice a year,
#       in April and October) and update the verdicts below.

---

## HOW TO USE THIS FILE

Before adding a new piece of infrastructure (a build tool, a hosting provider, a
database, a testing framework) — check here first. If it's not here, pull from
the sources listed at the bottom before deciding, the same way this file was built.

Each entry has a **Verdict** for PharmaCare specifically — "keep," "migrate
later," "migrate now," or "adopt" — not just what's trendy.

---

## FRONTEND

| Choice | Status | Verdict |
|---|---|---|
| React 19 | Current | **Keep.** Thoughtworks' default JS UI choice since 2016, React Compiler stable as of React 19. |
| Create React App (`react-scripts`/craco) | Current | **Migrate later.** React's own team deprecated CRA; Vite is now the recommended default (Vue, SvelteKit, and React all point to it). Thoughtworks Radar: **Adopt**. Not urgent — real, mechanical migration work for zero user-facing benefit today. Do it once, after pre-launch blockers are cleared. |
| Tailwind + Shadcn/UI | Current | **Keep.** Matches what modern healthtech OSS (OHC's `care_fe`) also uses. |
| Playwright (E2E) | Partial (18 test files exist, run in CI) | **Keep, expand.** Same tool OHC uses for `care_fe`. Real coverage exists — grow it, don't replace it. |

## BACKEND

| Choice | Status | Verdict |
|---|---|---|
| Python + FastAPI | Current | **Keep.** Thoughtworks: more teams adopting Python as preferred backend language, "good experiences with FastAPI." |
| SQLAlchemy 2.0 async (`AsyncSession`) | Current | **Keep — this is the correct pattern.** Synchronous SQLAlchemy blocks FastAPI's event loop and kills its concurrency advantage; async is the documented right way to pair the two. |
| PostgreSQL | Current | **Keep.** #1 database by adoption (55.6%) among current SaaS builds; matches ADR-001's original reasoning (relational data, ACID for financial records). |
| No mypy/type-checking in CI | Gap | **Adopt.** Pydantic validates at runtime; nothing catches a type error before deploy. Cheap to add, currently missing. |

## DEPLOYMENT / HOSTING (cost efficiency)

| Choice | Status | Verdict |
|---|---|---|
| `staging.yml` deploy steps are `echo` placeholders | Gap (documented blocker #4) | **Fix before launch.** No actual deploy automation exists today. |
| Self-managed Postgres | Current (local dev) | **Consider a managed Postgres for launch** (Supabase or Neon) — generous free tiers at low scale, no ops burden for a solo/small team, avoids paying for a dedicated DB server before you have paying users. |
| No PaaS target chosen yet | Gap | **A platform like Railway or Render fits this shape well** — "traditional server + background workers + DB in one place," good fit for a FastAPI + Postgres app, avoids raw VPS/SSH deploy scripting. Realistic early cost: under $20/month pre-revenue, well under $200/month even at initial traction. |

## API DESIGN

| Choice | Status | Verdict |
|---|---|---|
| No API versioning (`/v1/...`) | Gap | **Adopt before external integrations exist.** Right now every endpoint change risks breaking the one frontend that calls it — low cost to add now, expensive to retrofit once other clients exist. |
| No rate limiting | Gap (documented blocker #5) | **Fix before launch.** No protection against abuse today. |

---

## SOURCES USED TO BUILD THIS FILE

- [Thoughtworks Technology Radar — Vite](https://www.thoughtworks.com/radar/tools/vite) — Vite in **Adopt** ring; React deprecated CRA in its favor.
- [Thoughtworks Technology Radar — FastAPI](https://www.thoughtworks.com/radar/languages-and-frameworks/fastapi) — positive team experience, Python as preferred backend language.
- [Thoughtworks Technology Radar — full guide](https://www.thoughtworks.com/radar) — the living reference; re-check every April/October edition.
- Web search on 2026 SaaS MVP cost-efficient stacks — Postgres as #1 DB by adoption; Railway/Supabase/Neon as low-cost early-stage infra patterns.
- Direct comparison against [OHC Network's `care`/`care_fe`](https://github.com/ohcnetwork) — a real, large-scale (581 hospitals, 186M+ people) healthtech OSS project running a comparable stack (Django/Python backend, React+TS+Tailwind+Vite frontend, Playwright tests).

**How to refresh this file:** re-run the same method — pull the current Thoughtworks Radar (adopt/trial rings for languages, frameworks, tools, platforms), cross-check against 1-2 recent "SaaS stack" surveys, and compare against what a comparable well-run OSS project in the same domain uses. Update the verdicts, not just the sources.
