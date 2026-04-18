# PharmaCare

Indian pharmacy management SaaS — billing, inventory, purchases, GST reporting, and compliance.

## Quick Start

**Backend**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**
```bash
cd frontend
npm install
npm start        # runs on http://localhost:3000
```

Frontend `.env.local`:
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Tailwind CSS + Shadcn/UI |
| Backend | Python FastAPI + SQLAlchemy 2.0 async |
| Database | PostgreSQL |
| Auth | JWT |

## For Claude

Read `CLAUDE.md` — it is the single source of truth for all engineering and design decisions.
