---
paths:
  - "frontend/package.json"
  - "backend/requirements.txt"
  - "**/.env*"
---

# Dependency & Env Safety Rules — Never Break the App

Moved out of `CLAUDE.md` Sep 18, 2026 to keep that file under Anthropic's
documented 200-line target — this only loads when you're actually touching
a dependency manifest or an env file, instead of every session regardless
of task.

These rules exist because adding uninstalled packages and wrong env values have crashed the app multiple times.

## Adding a new package (frontend)
1. Run `npm install <package>` first — confirm "added X packages" in terminal
2. Only then add `import` statements in code
3. Never add a package to `package.json` manually without running `npm install`

## Adding a new package (backend)
1. Run `pip install <package>` inside venv first — confirm "Successfully installed"
2. Add to `requirements.txt` after install succeeds
3. Only then add `import` statements in `main.py` or any module

## Env files — strictly forbidden
- NEVER add a URL to `.env.production` unless it is a real, live production URL
- NEVER add placeholder values — an empty key is safer than a fake value
- `REACT_APP_BACKEND_URL` is set via CI secret only — never hardcode it in any env file
- Always state explicitly when touching any `.env*` file — treat it as a breaking change

## Verify after every infrastructure change
- After any change to `main.py` imports or `requirements.txt` → restart backend and confirm `Application startup complete`
- After any change to `package.json` or env files → restart frontend and confirm no compile errors
- One change at a time. Verify. Then next change.
