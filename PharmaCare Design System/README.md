# PharmaCare Design System

## Overview

**PharmaCare** is a full-featured Pharmacy Management System built for Indian pharmacies. It covers the complete operational workflow: billing/POS, inventory management, purchasing, sales/purchase returns, GST reporting, compliance (Schedule H1 Register), customer/supplier management, and multi-role team management.

The application is a React SPA with a persistent dark sidebar navigation and a light content area. It is designed for daily, high-frequency use by pharmacy staff — cashiers, inventory staff, managers, and admins.

**Source repository:** `abinash811/Pharmacare-April11-Claude-push` (GitHub)  
Frontend path: `frontend/src/`

---

## Product Surface

| Surface | Tech | Notes |
|---|---|---|
| Web App | React + Tailwind CSS + shadcn/ui | Single product; no mobile app or marketing site |

**Key modules:**
- Dashboard (sales metrics, charts, alerts)
- Billing / POS (create bills, manage payments)
- Billing Workspace (line-item builder)
- Sales Returns / Purchase Returns
- Inventory Search & Medicine Detail
- Purchases & Purchase Returns
- Customers & Suppliers
- Reports & GST Report
- Schedule H1 Register (compliance)
- Audit Log & Stock Movement Log
- Settings, Team, Roles & Permissions

---

## Content Fundamentals

**Tone:** Professional, functional, and direct. The UI is a data-heavy operational tool — copy is sparse and action-oriented, never playful.

**Voice:**
- Action verbs lead: "Create Bill", "Add Supplier", "Save Changes", "Delete"
- Second person avoided in UI labels; imperative or noun-based: "Logout" not "Sign out", "Refresh" not "Refresh data"
- No emoji anywhere in the interface
- Sentence case for body text; Title Case for nav items, page headers, and button labels
- Numbers formatted compactly (₹1.2L, ₹45K) using `formatCompact()` utility

**Nav group labels:** ALL CAPS, 10px, tracked — `DAILY OPS`, `RELATIONSHIPS`, `REPORTS`, `COMPLIANCE`, `ADMIN`

**Error/empty states:** Empathetic but minimal — "No bills yet. Create your first bill to get started."

**Indian context:** Rupee (₹) currency, GST (CGST/SGST/IGST) tax fields, Schedule H1 controlled substances register, standard Indian pharmacy workflows.

---

## Visual Foundations

### Colors
- **Brand primary:** `#4682B4` (Steel Blue)
- **Brand dark (hover):** `#3a6d96`
- **Brand tint (row hover):** `#f0f7ff`
- **Brand subtle (selected rows):** `rgba(70,130,180,0.10)`
- **Sidebar background:** `#1a2332` (dark navy)
- **App background:** `#f8f9fa` (off-white gray)
- **Surface / card bg:** `#ffffff`
- **Border:** `hsl(0 0% 89.8%)` ≈ `#e5e5e5`
- **Foreground (body text):** `hsl(0 0% 3.9%)` ≈ `#0a0a0a`
- **Muted text:** `hsl(0 0% 45.1%)` ≈ `#737373`
- **Destructive:** `hsl(0 84.2% 60.2%)` ≈ `#f04848` (red)

**Status color system:** Soft-tinted pill badges — green (paid/active), amber (due/pending/partial), red (overdue/cancelled), purple (credit/card/wholesale), blue (UPI/regular), gray (default/unknown)

### Typography
- **Primary font:** IBM Plex Sans (300, 400, 500, 600, 700) — all body and UI text
- **Display font:** Manrope (300–800) — available for headings/display contexts
- **Mono font:** Source Code Pro / Menlo / Monaco — code

**Scale:**
- Page title: `text-xl font-bold text-gray-900` (20px)
- Section group label: `text-[10px] font-medium uppercase tracking-widest text-gray-500`
- Nav item: `text-[13px] font-medium`
- Body: `text-sm text-gray-700` (14px)
- Muted / metadata: `text-xs text-gray-500` (12px)

### Spacing & Layout
- Page padding: `px-8 py-6`
- Sidebar width: `200px` (fixed)
- Nav item height: `36px` (h-9)
- Logo strip height: `56px` (h-14)
- Border radius base: `0.5rem` (8px); badges use `rounded-full`

### Cards & Surfaces
- White background, `border border-gray-200`, `rounded-lg`, `shadow-sm`
- Hover variant (`.card-hover`): lifts with `box-shadow` + `translateY(-2px)` on hover

### Backgrounds
- No gradients in the main app (auth page is the exception: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`)
- No illustrations, patterns, or textures
- Content area: flat `#f8f9fa`
- Sidebar: flat `#1a2332`

### Animations & Transitions
- Default: `0.2s ease` transitions on color/bg
- Button lift: `translateY(-1px)` on hover, back to `0` on active
- Button transition: `0.15s ease`
- Sidebar mobile drawer: `transform transition-transform duration-200 ease-in-out`
- Accordion (shadcn): `0.2s ease-out`
- Loading skeleton: `animate-pulse` (Tailwind)
- Spinner: `animate-spin` (Tailwind, Lucide `Loader2`)

### Hover / Press States
- Buttons: background darkens (primary: `#4682B4` → `#3a6d96`); body lifts translateY(-1px)
- Nav items: `hover:bg-white/5 hover:text-white`
- Active nav: `bg-blue-600/20 text-white`
- Table rows: `hover:bg-brand-tint` (#f0f7ff)
- Selected rows: `bg-brand-subtle` (rgba brand/10%)

### Borders & Shadows
- Main border: `border-gray-200` (1px solid)
- Page header bottom: `border-b border-gray-200 shadow-sm`
- Sidebar section dividers: `border-white/10`
- Focus ring: `ring-2 ring-brand ring-offset-2`
- No heavy outer shadows in data tables; subtle `shadow-sm` on cards only

### Corner Radii
- Standard: `rounded-lg` (8px)
- Button: `rounded-lg`
- Badge/pill: `rounded-full`
- Icon container: `rounded-md` or `rounded-full`
- Logo box: `rounded-xl` (12px) on auth page

### Imagery
- No photography or illustrations in the app UI
- Icons only (Lucide, stroke-style)
- No background images

### Color Vibe of Imagery
N/A — icon-only interface

---

## Iconography

**Icon system:** [Lucide Icons](https://lucide.dev/) — stroke-style SVG icons, consistent 2px stroke weight.

**Usage:**
- Nav icons: `w-4 h-4` (16px), `text-gray-400` inactive, `text-white` active
- Action buttons: `w-4 h-4` paired with text labels; `w-5 h-5` in metric cards
- Empty state icons: `w-8 h-8 text-gray-400` inside `w-16 h-16 bg-gray-100 rounded-full`
- Spinner: `<Loader2 className="w-4 h-4 animate-spin" />`

**Common icons used:**
- `LayoutDashboard` — Dashboard
- `ShoppingCart` — Billing
- `Package` — Inventory
- `ShoppingBag` — Purchases/Suppliers
- `Users`, `UserCog` — Customers, Team
- `FileText` — Reports, Compliance
- `Settings` — Settings
- `LogOut` — Logout
- `Menu`, `X` — Mobile hamburger/close
- `DollarSign`, `TrendingUp`, `BarChart3` — Metrics
- `RefreshCw` — Refresh
- `Loader2` — Loading spinner

No emoji, no unicode chars as icons, no custom SVG illustrations. The flaskbeaker SVG in the logo/sidebar is a hand-coded inline SVG (pharmacy logo mark).

**CDN:** Lucide is imported as an npm package in the codebase (`lucide-react`). For design artifacts, use from CDN: `https://unpkg.com/lucide@latest`

---

## Files Index

```
README.md                       ← This file
SKILL.md                        ← Agent skill definition (Claude Code compatible)
PROMPTS.md                      ← 8 Claude Code implementation prompts, priority ordered
colors_and_type.css             ← All CSS custom properties: colors, type, spacing, elevation, motion, density

assets/
  logo-mark.svg                 ← PharmaCare flask logo mark (SVG)

preview/
  ── Colors ──
  colors-brand.html             ← Primary, hover state, tint, subtle, secondary, destructive
  colors-status.html            ← Payment, customer type, and role badge palettes
  colors-ui.html                ← App bg, surface, border, text foreground ramp

  ── Type ──
  type-scale.html               ← Full size/weight scale from page title to nav group label
  type-fonts.html               ← IBM Plex Sans (primary) + Manrope (display) specimens

  ── Spacing / Tokens ──
  spacing-scale.html            ← 4px base grid + semantic aliases
  elevation.html                ← E0–E4 named shadow levels (card→modal→toast)
  motion.html                   ← Duration scale, easing curves, semantic transition aliases
  density.html                  ← Compact / Comfortable (default) / Spacious variants
  breakpoints.html              ← Web (≥1024px) vs iPad (768–1023px) layout rules

  ── Components ──
  buttons.html                  ← 6 variants, 4 sizes, all states
  badges.html                   ← Status badges: payment, customer type, roles
  nav-sidebar.html              ← Sidebar with grouped nav, logo strip, user footer
  cards-surfaces.html           ← Page header, metric cards, empty state
  page-header.html              ← PageHeader + underline tab navigation
  empty-states.html             ← No data, no results, error states
  form-inputs.html              ← Input states, search, expiry, select, textarea, checkbox
  data-table.html               ← Headers, sortable columns, row hover/select, actions, pagination
  modals.html                   ← Confirm, destructive, loading, input dialogs
  toasts.html                   ← Success, error, warning, info — Sonner usage rules
  loading-states.html           ← TableSkeleton, metric skeleton, inline loader, button loading
  pagination.html               ← PaginationBar states + usage rules

  ── Brand / Decisions ──
  data-formatting.html          ← Date functions, expiry colours, currency scale (paise warning)
  refinement-audit.html         ← P1/P2/P3 issues with exact file references
  accessibility.html            ← WCAG AA contrast, ARIA requirements, focus rings, touch targets
  icon-library.html             ← All Lucide icons used — sizes, colors, usage rules
  copy-guidelines.html          ← Voice, casing, button copy, error messages, number formatting
  role-based-ui.html            ← Admin/Manager/Cashier/Inventory — nav matrix, permissions
  dark-mode.html                ← Light vs dark token mapping, implementation status

  ── Product Screens ──
  invoice-print.html            ← Full A4 GST tax invoice print template
  error-pages.html              ← 404, 500, offline, 403 error screens
  data-viz.html                 ← Chart palette, bar/line/donut, Recharts config standards

  ── Approved Designs ──
  design-metric-card.html       ✅ Approved — sparkline, accent line, change pill, delta footer
  design-auth.html              ✅ Approved — split layout desktop / dark centered iPad
  design-billing-shortcuts.html ✅ Approved — kbd hints + shortcut legend
  design-dashboard-zero.html    ✅ Approved — onboarding card for new pharmacies
  design-button-system.html     ✅ Approved — unified 6-variant system, shortcut prop

ui_kits/
  pharmacare/
    README.md                   ← UI kit notes
    index.html                  ← Interactive prototype: Auth → Dashboard → Billing → Inventory
```
