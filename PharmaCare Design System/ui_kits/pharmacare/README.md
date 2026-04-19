# PharmaCare UI Kit

Interactive click-through prototype of the PharmaCare web app.
Source: `abinash811/Pharmacare-April11-Claude-push` (frontend/)

## Screens
1. **Login** — Auth page with email/password form
2. **Dashboard** — Metric cards, quick stats, alerts panel
3. **Billing List** — Bills table with status badges, search, tabs
4. **Billing Workspace** — Line-item builder / POS screen
5. **Inventory Search** — Medicine search with stock/expiry info

## Components
- `Layout.jsx` — Sidebar + app shell
- `Dashboard.jsx` — Dashboard screen
- `BillingList.jsx` — Billing list screen
- `BillingWorkspace.jsx` — New bill POS
- `InventorySearch.jsx` — Inventory search
- `AuthPage.jsx` — Login screen

## Notes
- Fonts: IBM Plex Sans + Manrope via Google Fonts
- Icons: Lucide (inline SVG — no CDN dependency)
- All data is static/mocked; no backend calls
- Tailwind replaced with vanilla CSS using design tokens from colors_and_type.css
