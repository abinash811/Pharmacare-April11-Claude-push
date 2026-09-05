---
name: pharmacare-deployment
description: Governs PharmaCare's deployment, environment variables, and CI/CD gates. Use this whenever touching an env file, discussing a production/staging release, changing a GitHub Actions workflow, or asked whether something is "ready to deploy" or "pre-launch ready." Deployment is a "narrow bridge" operation like a database migration — one safe sequence, high cost if skipped — so this states exact required steps, not general guidance.
---

# PharmaCare Deployment

## Why this exists

Adding uninstalled packages and wrong env values have crashed the app
multiple times. Env files and deploy steps are exactly the kind of
mistake that isn't visible until it's live.

## Before you start

Read `CLAUDE.md`'s "DEPENDENCY & ENV SAFETY RULES" section if you
haven't this session — this skill operationalizes it, not replaces it.

## Non-negotiables

1. **Never add a URL to `.env.production` unless it's real and live.**
   No placeholders — an empty key is safer than a fake value.
2. **`REACT_APP_BACKEND_URL` is a CI secret only.** Never hardcoded in
   any env file.
3. **Always state explicitly when touching any `.env*` file** — treat it
   as a breaking change, not a routine edit.
4. **One infra change at a time, verified before the next.** After a
   `main.py` import or `requirements.txt` change → restart backend,
   confirm `Application startup complete`. After a `package.json` or env
   change → restart frontend, confirm no compile errors.

## Pre-deploy checklist

See `docs/13_DEPLOYMENT.md`'s "PRE-DEPLOY CHECKLIST" and "PRE-LAUNCH
BLOCKERS" sections for the full list — read it fresh each time, it's a
Living Status document that changes as blockers get resolved. Do not
call anything "ready to deploy" from memory of an earlier session.

## Migrations at deploy time

Never run `alembic upgrade head` manually against a remote database as
a one-off — see `docs/13_DEPLOYMENT.md`'s "DATABASE MIGRATIONS" section
for the actual deploy-time migration process, and the
`pharmacare-database` skill for migration authoring itself.

## CI/CD gate

CI runs automatically on every push to a feature branch (`ci.yml`'s
`push` trigger covers `claude/**`/`fix/**`, not just `main`). A change
isn't done until CI is green — see `docs/13_DEPLOYMENT.md`'s "CI/CD —
WHAT ACTUALLY EXISTS" for the current real pipeline, and the
`pharmacare-testing` skill for how to verify before pushing.
