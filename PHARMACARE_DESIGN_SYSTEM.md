== PHARMACARE DESIGN SYSTEM — READ BEFORE WRITING ANY CODE ==

App: PharmaCare | React + Tailwind CSS + MongoDB | Single Indian pharmacy

CORE PRINCIPLE: Every module uses the same component skeleton. A user who learns billing knows purchases, returns, customers, and suppliers automatically. Never invent new UI patterns. Always reuse what exists.

---

GLOBAL RULES:
1. App name is PharmaCare. Never rename it.
2. Do NOT refactor server.py into routers.
3. Do NOT delete or deprecate existing working pages.
4. Audit first, build only what is missing.
5. No hardcoded or dummy data anywhere.
6. After completing, share screenshots before doing anything else.

---

COLOR TOKENS (use these exact values, never invent new colors):
Primary teal:     #0C7A6B  → buttons, links, active chips, bill numbers
Teal hover:       #0A6859  → button hover state
Teal bg:          #E6F4F2  → active chip background, section highlights
Teal border:      #9DCEC8  → active chip border, card accents
Dark text:        #0F0F0E  → headings, strong values
Body text:        #5A5A57  → labels, descriptions
Muted text:       #989894  → placeholders, secondary info
Surface white:    #FFFFFF  → cards, main background
Surface grey:     #F7F7F6  → table header, alternate rows, subbar
Border light:     rgba(0,0,0,0.06) → card borders, table dividers
Red:              #CC2F2F  → due amounts, errors, delete hover
Red bg:           #FEF2F2  → due badge background
Amber:            #B87010  → parked, warnings, schedule H
Amber bg:         #FFF7E6  → parked badge background
Green:            #166B3E  → cash, paid, in-stock, positive values
Green bg:         #EDFAF2  → cash badge background
Blue:             #1D52CC  → UPI badge
Blue bg:          #EEF2FF  → UPI badge background

---

TYPOGRAPHY:
Font family: DM Sans (already loaded in project)
Monospace: DM Mono (for amounts, bill numbers, batch numbers)
Table headers: text-xs font-medium text-gray-500 uppercase tracking-wide
Body text: text-sm (13px)
Amounts: font-mono font-semibold
Large totals: text-lg font-bold font-mono

---

COMPONENT PATTERNS — reuse these exact patterns in every module:

[A] LIST SCREEN (BillingOperations.js is the reference)
Structure: Page header → Filter bar → Scrollable table → Sticky footer
- Page header: module title + today's stats subtitle | right: action buttons
- Filter bar: search input + date range pill + entity search + filter pills (All / type options)
- Table: sticky thead, row hover bg-gray-50, click row → detail view
- Reference numbers (bill no., CN, PUR no.): teal monospace, always clickable
- Status badges: rounded-full px-2 py-0.5 text-xs font-medium — use color tokens above
- Row hover actions: opacity-0 → opacity-100 on row hover (print, whatsapp icons)
- Sticky footer: left = "X today · Parked X · Pending due X" | right = "Total: ₹X" bold teal

[B] CREATE / EDIT SCREEN (BillingWorkspace.js is the reference)
Structure: Page header (breadcrumb) → Single-row subbar → Table/form area → Sticky two-row footer
- Page header: ← back | breadcrumb | title
- Subbar: single compact row of chips — each chip has icon + small label above + value below. Same height, same border (1px border-light), same border-radius (6px), same padding. Active/filled chips: teal-bg background + teal-border border + teal text.
- Table: same column header style as billing. Inputs: no border until focused, focus = blue ring. Sub-row below item name shows: batch · LP ₹X · ▲margin% · content.
- Sticky footer Row 1 (bg-gray-50): metric chips — label small/muted above, value below. Net total right-aligned, larger, bold.
- Sticky footer Row 2: left = contextual controls (discount input etc.) | right = action buttons (Print | Secondary | Primary teal)
- Save button: primary teal + caret dropdown for secondary save options

[C] DETAIL / VIEW SCREEN
Same layout as create screen but all fields read-only.
- Status badges in page header (CONFIRMED green, DUE red/amber, PARKED amber)
- More dropdown (⋯ button): Edit | Print | [Module-specific action] | Logs
- Footer Row 2: relevant action button (Mark as Paid if DUE, Return button, etc.) + Print

[D] MASTER RECORD SCREEN (Customers, Suppliers, Doctors)
Structure: List view → Click row → Detail panel
- List: same filter bar pattern as [A]
- Detail: tabs — Overview | Transaction History | Outstanding (if financial entity)
- Overview tab: profile info in a clean card grid
- History tab: same table pattern as list screens, filtered to this entity
- Outstanding tab (suppliers/patients): running balance + payment history table + "Record Payment" button

[E] INVOICE BREAKDOWN MODAL (same pattern for billing, purchases, returns)
- Two-column layout: left = note textarea + summary items | right = financial breakdown
- Financial rows: label left, value right, editable fields show input box
- Net total: large, teal, bold
- Buttons: Cancel | Save & Print | Confirm & Save (primary teal)

[F] SEARCH MODALS (patient search, supplier search, doctor search)
- Full search input at top, autofocus
- First option always = the "no record" option (Counter Sale, Walk-in, etc.)
- Results: avatar/icon + name + subtitle (phone, GSTIN, etc.)
- Keyboard: arrow keys navigate, Enter selects

---

MODULE CONNECTION RULES (enforce in every module):
- Billing save → decrement inventory stock (medicineId, batchNo, qty)
- Purchase confirm → increment inventory stock + update LP to PTR
- Sales return save → increment inventory stock (same batch) + generate CN
- Purchase return save → decrement inventory stock + reduce supplier outstanding
- Any credit transaction → update entity outstanding (patient or supplier)
- Any payment recorded → add to entity payment_history array

---

SIDEBAR NAVIGATION ORDER (do not change):
Dashboard → Billing → Inventory → Purchases → Customers → Suppliers → Reports → GST Report → Settings → Users → Roles

---

HOW TO USE THIS FILE:
Every time a new module or feature is built, read this file first. Match the pattern exactly. If a module already exists and does not match these patterns, flag it but do not change it unless explicitly asked.

== END OF DESIGN SYSTEM ==
