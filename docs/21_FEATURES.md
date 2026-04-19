# PharmaCare — Feature Reference
# Last updated: April 19, 2026
# Audience: Developers, designers, new hires, product reviewers
# Purpose: For every feature — why it exists, who uses it, how it works in the product.
# Rule: Update this file every time a feature ships or changes behaviour.

---

## HOW TO READ THIS FILE

Each feature entry answers 4 questions:
1. **What** — one-line description
2. **Why** — the real-world pharmacy problem it solves
3. **Who** — which persona uses it (Rajesh/Owner, Priya/Cashier, Suresh/Manager, Meena/Accountant)
4. **How** — exactly how it works in the product, step by step

---

## SETTINGS

### Pharmacy Profile
**What:** Edit the pharmacy's core identity — name, address, contact, compliance numbers, logo.

**Why:** Every pharmacy bill, GST report, and compliance document needs the pharmacy's legal details. Without this, bills print with blank headers and GST reports have missing GSTIN. This is the single source of truth for all pharmacy-identifying information across the product.

**Who:** Rajesh (Owner) — set up once on onboarding, updated when details change.

**How:**
1. Settings → Pharmacy Profile tab
2. Upload logo via drag & drop (converts to base64, stored in DB)
3. Fill name, phone, email, address, city, state, pincode
4. Enter compliance numbers: GSTIN (auto-uppercases, validates 15-char format), Drug License No., Drug License Expiry, FSSAI, PAN
5. Drug License Expiry shows amber warning badge if expiring within 90 days
6. Inline validation — phone must be 10-digit Indian mobile, pincode must be 6 digits, GSTIN must match Indian format
7. Save applies to all future bills and reports instantly

**Key rules:**
- GSTIN: 15 characters, format `22AAAAA0000A1Z5`
- Drug license expiry warning fires at 90 days — same threshold as notifications setting
- Logo stored as base64 data URL in `pharmacies.logo_url`

---

### Receipt & Print
**What:** Control exactly what appears on every printed bill — logo, compliance numbers, header/footer text, signature line — with a live preview.

**Why:** The printed bill is the pharmacy's face to the customer and the legal document for every transaction. Indian pharmacies are legally required to show GSTIN and Drug License on bills. The pharmacist needs to see exactly what will print before changing anything — surprises on printed bills waste paper and cause customer confusion.

**Who:** Rajesh (Owner) — configures once. Priya (Cashier) benefits every time she prints.

**How:**
1. Settings → Receipt & Print tab
2. Left panel: controls. Right panel: live bill preview that updates instantly on every change
3. **Paper size** — select A4, A5, 58mm thermal, 80mm thermal. Preview switches layout accordingly
4. **Logo** — drag & drop upload with instant preview. Remove with × button
5. **Show on Bill toggles** — GSTIN, Drug License No., FSSAI, Patient Name, Signature Line — each toggle immediately reflects in the preview
6. **Bill Header** — text that appears below pharmacy name (e.g. tagline, extra address line)
7. **Bill Footer** — text at the bottom of every bill (e.g. "Thank you, get well soon")
8. Save applies to all future bills. Existing printed bills are not affected

**Key rules:**
- Preview uses `invoice-print.html` design system format: dark `#1a2332` header, meta row, parties, items table, GST summary, footer
- Thermal layouts (58mm/80mm) use compact mono font receipt format
- Logo uploaded here is the same field as Pharmacy Profile logo — they share `logo_url`

---

### Tax & GST
**What:** Configure how GST is calculated, what HSN codes are auto-applied, and how GST appears on bills.

**Why:** Indian pharmacy GST has nuances: most medicines are 5% or 12%, surgical items differ, composition scheme pharmacies calculate GST differently, interstate sales use IGST not CGST+SGST. Wrong GST = wrong filing = penalties. Smart defaults mean the average pharmacist never has to touch this.

**Who:** Rajesh (Owner) sets up once. Meena (Accountant) may adjust for GST filing period.

**How:**
1. Settings → Tax & GST tab
2. **Composition Scheme** — toggle ON if pharmacy is registered under GST composition scheme (turnover < ₹1.5 Cr). Shows info banner when enabled. GST calculation changes to flat rate
3. **Interstate Sales (IGST)** — toggle ON if pharmacy bills customers from other states. Switches from CGST+SGST split to single IGST
4. **Default GST Rate** — click 0% / 5% / 12% / 18% button. Applied automatically when adding a new product without a specified rate
5. **Default HSN Codes** — pre-filled: 3004 for medicines (global standard for pharma), 9018 for surgical. Override if needed
6. **Auto-apply HSN** — when ON, new products in inventory get HSN auto-filled from these defaults
7. **Round off amount** — rounds grand total to nearest rupee on every bill
8. **Print GST summary table** — shows HSN-wise CGST/SGST breakdown at the bottom of printed bills

**Key rules:**
- Default HSN 3004 covers most oral, topical, and injectable medicines
- Default HSN 9018 covers surgical instruments, syringes, diagnostic equipment
- Composition scheme and IGST are mutually exclusive workflows
- `default_gst_rate` stored as Numeric(5,2) — never a float in business logic

---

### Notifications
**What:** Control which in-app alerts appear and when — low stock, near expiry, drug license expiry.

**Why:** A pharmacist managing 500+ SKUs cannot manually track every stock level and expiry date. Proactive alerts at the right threshold prevent stock-outs (lost sales), expired stock on shelf (legal risk + financial loss), and drug license lapse (business shutdown risk). The key is the right threshold — alert too early and it becomes noise, too late and it's useless.

**Who:** Suresh (Manager) — primary responder to stock/expiry alerts. Rajesh (Owner) — cares about drug license alerts.

**How:**
1. Settings → Notifications tab
2. Three alert cards — Low Stock, Near Expiry, Drug License Expiry
3. Each card has a **toggle** to enable/disable the alert entirely
4. When enabled, a **stepper** (− / days / +) sets the threshold — no typing needed, zero cognitive load
5. Each card shows a **live toast preview** — the exact notification that will appear in-app at that threshold
6. Thresholds:
   - Low Stock: alert when stock will last less than X days (default 30)
   - Near Expiry: alert when batch expires within X days (default 90)
   - Drug License: alert X days before license expires (default 90)
7. Save to persist. Alerts fire on Dashboard load and key page loads

**Key rules:**
- These are in-app alerts only — no email, no SMS in Phase 1
- **Near expiry days here ≠ near expiry days in Inventory tab.** Notifications threshold = when the dashboard alerts the manager so they have time to reorder (default 90 days). Inventory threshold = when billing shows a warning to the cashier at point of sale (default 30 days). Different audiences, different moments, both necessary.
- **Low stock here ≠ low stock in Inventory tab.** Notifications = proactive dashboard alert for the manager. Inventory = operational block/warn at billing counter for the cashier.
- Drug license expiry badge in Pharmacy Profile uses the same `drug_license_alert_days` threshold
- Toast style matches design system: warning (amber) for stock/expiry, info (brand blue) for license

---

### Drug License Expiry Banner
**What:** Amber strip above Dashboard metric cards when the pharmacy's drug license is expiring soon (or has expired).

**Why:** A lapsed drug license means the pharmacy is operating illegally — this is a business-critical alert, not a soft reminder. The banner is impossible to miss because it sits above every metric the pharmacist looks at daily. It links directly to Settings so they can update the date once renewed. It's dismissible so it doesn't block work.

**Who:** Rajesh (Owner) — the only person who can act on a license renewal.

**How:**
1. Dashboard loads → API returns `license_alert` object with `enabled`, `days_left`, `expiry_date`
2. If `enabled = true` (alert_drug_license_enabled AND within alert_days threshold):
   - Banner appears above metric cards
   - Shows expiry date + days remaining in plain language
   - If expired: red variant with urgent "operating illegally" language
   - If within threshold: amber variant with count of days remaining
3. "Update in Settings" link navigates to `/settings` (Profile tab has the drug license date)
4. × button dismisses for the session — reappears on next page load

**Key rules:**
- Threshold driven by `drug_license_alert_days` from Notifications settings (default 90 days)
- Amber for "expiring soon" / Red for "already expired"
- Session-only dismiss — no persistent "snooze". The pharmacist needs to see this every day until they act
- Banner is `null` when `license_alert.enabled === false` — zero render cost

---

## BILLING

### Create Bill
**What:** Create a GST-compliant bill for a customer in under 60 seconds.

**Why:** Speed is survival at a pharmacy counter. A queue of 10 patients waiting while the cashier struggles with software is a lost customer. Billing must be fast, accurate, and require zero mental effort for GST calculation.

**Who:** Priya (Cashier) — primary user, uses this 80-100 times per day.

**How:**
1. Billing → New Bill (or press `n`)
2. Search medicine by name or barcode — autocomplete from inventory
3. Qty updates automatically, MRP locked (cannot exceed legal MRP)
4. GST calculated in integer paise — no float errors
5. Add discount at item level (%) or bill level (₹)
6. Schedule H medicines prompt for doctor name — cannot settle without it
7. Settle: choose Cash / UPI / Card / Credit
8. Bill number assigned atomically (INV-000001) — no gaps, no duplicates
9. Stock deducted from correct batch (FEFO — earliest expiry first)
10. Schedule H1 entry auto-created if applicable
11. Print or share bill

**Key rules:**
- Draft bills use DRAFT- prefix — no stock deduction
- Settled bills use INV- prefix — stock deducted, number locked
- MRP is legally fixed — system enforces it
- All amounts in integer paise internally, display converts to ₹

---

### Sales Returns
**What:** Process a return from a customer — refund money, restore stock.

**Why:** Medicines get returned for wrong items, duplicate prescriptions, or product defects. The return must be linked to the original bill, reverse the GST exactly, and restore stock to the correct batch.

**Who:** Priya (Cashier) or Suresh (Manager).

**How:**
1. Billing → Returns tab → New Return
2. Search original bill number
3. Select which items to return (partial return supported)
4. System calculates refund amount with GST reversal
5. Stock restored to original batch
6. Return number assigned (RTN- prefix)
7. Credit note issued

---

## INVENTORY

### Product Catalog
**What:** Master list of all medicines and products sold by the pharmacy.

**Why:** Every bill, purchase, and report depends on accurate product data. The product stores the medicine name, manufacturer, drug schedule, GST rate, HSN code, and default MRP. Without this master, billing is impossible.

**Who:** Suresh (Manager) — maintains the catalog. Priya (Cashier) — reads it during billing.

**How:**
1. Inventory → Add Product
2. Enter generic name, brand name, manufacturer, pack size
3. Set drug schedule (OTC / H / H1 / X) — determines billing rules
4. Set GST rate — defaults from Tax & GST settings
5. Set HSN code — auto-filled from Tax & GST defaults if enabled
6. Save — product appears in billing search instantly

---

### Batch Tracking
**What:** Every stock entry is linked to a specific batch — batch number, expiry date, MRP, cost price, quantity.

**Why:** Indian regulations require batch-level tracking for drug recalls. Financially, it's critical for FEFO stock rotation (sell oldest first to minimise expiry loss). FEFO is automatic — the system always picks the earliest-expiring batch when billing.

**Who:** Suresh (Manager) — creates batches on purchase receipt.

**How:**
1. Batches created when a purchase is confirmed
2. Each batch stores: batch_number, expiry_date, mrp_paise, cost_paise, qty_strips
3. On billing: system picks FEFO batch automatically
4. Stock movements logged for every deduction/addition

---

## PURCHASES

### Purchase / GRN
**What:** Record stock received from a supplier — creates batches, updates inventory.

**Why:** Stock cannot be billed if it isn't in the system. Every purchase must be recorded with batch numbers and expiry dates. This also builds the purchase history per supplier for payment tracking.

**Who:** Suresh (Manager) — daily/weekly task when stock arrives.

**How:**
1. Purchases → New Purchase
2. Select supplier
3. Add items with batch number, expiry, MRP, cost, qty
4. Save as draft or confirm (confirm = stock added immediately)
5. Purchase number assigned (PUR-YYYYMMDD-XXXX)
6. Batches created in inventory
7. Stock movements logged

---

## REPORTS & COMPLIANCE

### GST Report
**What:** HSN-wise sales summary for a date range — ready to hand to the accountant for GSTR-1 filing.

**Why:** Every Indian business must file GST monthly. The accountant needs a breakdown of: how much was sold at 5%, at 12%, at 18% — HSN-wise, with CGST/SGST split. Manual calculation from hundreds of bills takes days and is error-prone.

**Who:** Meena (Accountant) — uses this monthly.

**How:**
1. Reports → GST tab
2. Select date range
3. System aggregates all settled bills by HSN code and GST rate
4. Shows taxable amount, CGST, SGST, total tax per slab
5. Export to Excel for accountant

---

### Schedule H1 Register
**What:** Auto-generated compliance register of all Schedule H1 drug sales.

**Why:** Every pharmacy selling Schedule H1 medicines (antibiotics, certain painkillers, psychotropics) is legally required to maintain a physical register with: medicine name, quantity, patient name, doctor name, date. Drug inspectors check this during raids. PharmaCare auto-generates it from billing data — the pharmacist never has to maintain it manually.

**Who:** Rajesh (Owner) — for inspector visits. Priya (Cashier) — enters doctor name during billing.

**How:**
1. Compliance → Schedule H1 Register
2. Filter by date range
3. Displays: date, patient name, doctor name, medicine, batch, qty, bill number
4. Print directly for inspector

---

### Audit Log
**What:** Immutable record of every action taken in the system — who did what, when.

**Why:** Pharmacy owners need to know if a cashier deleted a bill, changed a price, or voided a return. This is also required for GST audit trails. Every action is logged — it cannot be edited or deleted.

**Who:** Rajesh (Owner) — reviews when disputes arise.

**How:**
1. Audit Log page
2. Filter by user, action type, date range
3. Every create/update/delete across all modules is logged with: timestamp, user, action, before/after values

---

## TEAM & ACCESS

### Members
**What:** Invite staff to the pharmacy system, assign roles, and control who has access.

**Why:** A pharmacy has multiple staff — owner, manager, cashiers, inventory staff. Each person needs a login with the right level of access. Without this, everyone shares one account, there is no audit trail, and there is no way to revoke access when someone leaves.

**Who:** Rajesh (Owner) — manages the team. Every staff member gets their own account.

**How:**
1. Team → Members tab
2. Search members by name or email
3. **Invite Member** — enter name, email, password, role → creates their account immediately
4. **Edit** — change name, email, or role for any member
5. **Deactivate** — blocks sign-in immediately. Soft delete — data preserved, audit trail intact
6. **Reactivate** — restores access for a returning staff member
7. **Change Password** — logged-in user can change their own password

**Key rules:**
- Admin cannot deactivate their own account
- Deactivated users retain all their historical records (bills, purchases, audit logs) — data is never deleted
- Password minimum 6 characters. Admins setting passwords for new staff should communicate it securely.
- Session management (view active devices, force logout) is on the roadmap — see Auth Overhaul in ROADMAP.md

---

### Roles & Permissions
**What:** Define what each staff member can and cannot do in the system.

**Why:** A cashier should not be able to delete bills or change settings. A manager should not access owner-level financial reports. Role-based access prevents fraud, errors, and data breaches.

**Who:** Rajesh (Owner) — sets up roles. Applied to all staff.

**How:**
1. Team → Roles tab
2. Four default roles: Admin, Manager, Cashier, Inventory Staff
3. Each role has a permission set (e.g. `billing:create`, `settings:write`)
4. Assign role to user at invite
5. Custom roles can be created
6. System roles (Admin) cannot be deleted

---

*Add a new section every time a feature ships.*
*Owner: the developer who builds the feature writes the entry.*
*Format: What / Why / Who / How — always in this order.*
