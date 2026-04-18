# PharmaCare — Product Document
# Version: 1.0 | Last updated: April 18, 2026
# Owner: Founder
# Audience: Everyone — founders, developers, designers, investors, new hires
# Rule: This document is updated every time a major feature ships or strategy shifts.

---

## 1. ONE-LINE VISION

> **Give every Indian pharmacy the operating system it deserves — modern, compliant, and built for how India actually works.**

---

## 2. THE PROBLEM

### 2.1 The Scale of Indian Pharmacy

India has over **9 lakh (900,000+) registered retail pharmacies** — more than any other country in the world. Nearly every Indian family has a neighborhood pharmacy they trust. Yet behind the counter, almost all of these pharmacies operate on:

- Paper ledgers or basic billing software from the early 2000s
- No real-time inventory visibility
- Manual GST calculations prone to errors
- Handwritten Schedule H1 registers (legally mandatory)
- No expiry tracking — leading to financial loss and legal risk
- No supplier payment tracking
- Zero insight into margins, fast-moving products, or dead stock

The biggest players in pharma software today — **Busy, Marg, WinPOS, PharmaERP** — are powerful but built for accountants, not pharmacists. They are:
- Complex to learn (weeks of training)
- Ugly interfaces that feel like Windows XP
- Expensive for small pharmacies
- Not built for GST from the ground up
- Not mobile-friendly
- Designed for data entry clerks, not owners who want insight

### 2.2 The Real Pain (from owner's perspective)

| Pain | What it costs them |
|------|-------------------|
| Manual billing is slow | Long queues, lost customers, billing errors |
| No expiry tracking | Expired stock sits on shelf = financial loss + legal risk |
| GST filing takes 2 days | Accountant fees, errors, late filing penalties |
| Schedule H1 register is handwritten | Inspector visits cause anxiety, compliance risk |
| No purchase tracking | Over-ordering, stock-outs, supplier disputes |
| No margin visibility | Don't know which products actually make money |
| Sales returns are manual | Credit notes lost, customer disputes |
| No supplier payment tracking | Relationships strained, missed discounts |

### 2.3 What No One Has Solved

Every existing solution makes the pharmacist fit into the software. **We make the software fit the pharmacist.** The goal is: a pharmacist who has never used software in their life should be able to bill a customer within 10 minutes of first opening PharmaCare.

---

## 3. THE SOLUTION

PharmaCare is a **pharmacy operating system** — not just billing software. It handles every operation a pharmacy performs, end to end:

1. **Billing** — Fast, accurate, GST-compliant sales
2. **Inventory** — Real-time stock, batch-level tracking, expiry alerts
3. **Purchases** — Purchase orders, GRN, supplier management
4. **Compliance** — Schedule H1 register auto-generated, audit log, GST reports
5. **Finance** — Margins, outstanding payments, supplier ledger
6. **Team** — Roles, permissions, activity tracking

The interface is built to the standard of **Linear, Notion, and Stripe** — clean, fast, opinionated. Not customizable to the point of confusion. Beautifully simple with powerful depth.

---

## 4. TARGET USERS

### 4.1 Primary Market (Phase 1)

**Single-store independent pharmacy in India**
- 1 to 5 staff members
- Owner-operated or with a hired pharmacist
- Revenue: ₹5 lakh to ₹50 lakh per month
- Location: Tier 1, Tier 2, and Tier 3 cities
- Currently using: paper, Tally, Busy, or no software at all

### 4.2 User Personas

#### Persona 1 — Rajesh (The Owner)
- Age: 42, owns pharmacy for 15 years
- Non-technical but smart with money
- Checks margins, worries about expired stock, hates GST paperwork
- On his phone most of the day
- **Needs:** Dashboard showing today's sales, margin per product, expiry alerts, GST summary
- **Fear:** Inspector visit, expired stock, staff billing errors

#### Persona 2 — Priya (The Cashier/Pharmacist)
- Age: 26, hired pharmacist with D.Pharm
- Handles 80-100 bills per day
- Speed and accuracy matter above all else
- **Needs:** Fast billing, easy product search, clear stock levels, simple returns
- **Fear:** Billing mistakes, queue building up, system going slow

#### Persona 3 — Suresh (The Store Manager)
- Age: 35, manages day-to-day for owner who is often absent
- Handles purchases, supplier calls, stock audits
- **Needs:** Purchase management, supplier ledger, stock reports, low-stock alerts
- **Fear:** Stock-out of fast-moving items, supplier payment disputes

#### Persona 4 — Meena (The Accountant)
- Age: 38, comes once a week or month
- Files GST returns (GSTR-1, GSTR-3B), reconciles books
- **Needs:** Clean GST report export, HSN-wise summary, payment records
- **Fear:** Wrong GST amounts, missing invoices, penalties

### 4.3 Secondary Market (Phase 2)

**Pharmacy chains** — 2 to 50 stores, centralized management, inventory transfers between stores, consolidated reporting.

### 4.4 Future Market (Phase 3+)

- Hospital-attached pharmacies
- Wholesale distributors
- Government health scheme pharmacies (Jan Aushadhi, Ayushman Bharat)

---

## 5. PRODUCT PRINCIPLES

These are non-negotiable. Every feature decision is measured against these.

### 5.1 Speed over features
A cashier billing 100 patients a day cannot wait 3 seconds for a search result. Performance is a feature. Every interaction must feel instant.

### 5.2 Compliance is invisible
Indian pharmacy compliance is complex — Schedule H1, GST, drug licensing. The pharmacist should never have to think about compliance. It should happen automatically in the background as they work.

### 5.3 One way to do each thing
There is one way to create a bill. One way to add stock. One way to process a return. No options that confuse. No settings that break things. Opinionated defaults that work for 95% of pharmacies.

### 5.4 Trust through data integrity
Pharmacy data is not just business data — it is medical and legal data. We never hard-delete. We never allow duplicate bill numbers. We never allow data that could put a pharmacist at legal risk. The system is the source of truth.

### 5.5 Built for India
MRP is legally fixed. GST has 5 slabs. Drugs are categorized by schedule. Batch numbers matter for recalls. Every feature is built for Indian regulations, Indian pricing, Indian workflows — not adapted from a Western product.

---

## 6. REGULATORY CONTEXT (Critical for all developers)

Every developer must understand this. Getting this wrong has legal consequences for our customers.

| Regulation | What it means for PharmaCare |
|------------|------------------------------|
| **MRP (Maximum Retail Price)** | Legally fixed by manufacturer. Cannot sell above MRP. System must enforce this. |
| **Schedule H drugs** | Require valid prescription. Must be tracked. Cannot be sold OTC. |
| **Schedule H1 drugs** | Stricter — must maintain a physical register with patient details, doctor name, quantity. PharmaCare auto-generates this register. |
| **Schedule X drugs** | Narcotics and psychotropics. Strictest controls. Future feature. |
| **GST on medicines** | 0% (life-saving), 5% (most medicines), 12%, 18% (some medical devices). HSN code determines rate. |
| **Drug License** | Every pharmacy must have one. Expires and must be renewed. Future feature: renewal alerts. |
| **Batch tracking** | Every batch has a number and expiry. Required for drug recalls. PharmaCare tracks at batch level, never just product level. |
| **CDSCO** | Central Drugs Standard Control Organisation — national regulator. All drug standards come from here. |

---

## 7. WHAT WE ARE BUILDING

### 7.1 Currently Built (Phase 1 — Complete)

| Module | Status | Notes |
|--------|--------|-------|
| Authentication | ✅ | Email/password + Google OAuth |
| Dashboard | ✅ | KPIs, alerts, recent activity |
| Billing | ✅ | GST-compliant, bill number sequences, settlements |
| Sales Returns | ✅ | Credit notes, stock reversal |
| Inventory | ✅ | Product master, batch-level stock, expiry tracking |
| Stock Movements | ✅ | Full ledger of every stock change |
| Purchases | ✅ | GRN, supplier-linked, batch creation on receive |
| Purchase Returns | ✅ | Debit notes, stock deduction |
| Customers | ✅ | Customer + doctor master |
| Suppliers | ✅ | Supplier master, payment tracking |
| Reports | ✅ | Sales, purchases, margin analysis |
| GST Report | ✅ | HSN-wise, GSTR-1 ready |
| Schedule H1 Register | ✅ | Auto-generated from billing data |
| Audit Log | ✅ | Every action tracked |
| Settings | ✅ | Bill sequences, inventory config, GST config |
| Team | ✅ | User management, roles |

### 7.2 In Progress

| Feature | Description |
|---------|-------------|
| Right-side Sheets | Replace centered modals with slide-in drawers for all data entry |
| Zod form validation | All forms validated with Zod schemas + react-hook-form |
| Error retry states | Network errors show inline alert + retry button |
| Code quality engine | ESLint custom rules + pre-commit hooks enforcing design system |

### 7.3 Planned — Next Quarter

| Feature | Why it matters |
|---------|---------------|
| Command Palette (Cmd+K) | Power users navigate instantly without mouse |
| Speed keys | `n` new, `f` filter, `/` search, `Esc` close, `Enter` confirm |
| Barcode scanning | Scan product barcode to add to bill or receive stock |
| Low stock alerts | Automatic notification when stock hits reorder level |
| Expiry alerts | 3-month, 1-month warnings on dashboard |
| Bulk purchase import | Excel upload for large purchase orders |
| Print templates | Customizable bill, prescription label, sticker |

### 7.4 Planned — Multi-store (Phase 2)

| Feature | Description |
|---------|-------------|
| Multi-store dashboard | Consolidated view across all locations |
| Inter-store transfers | Move stock between branches |
| Centralized purchasing | Head office raises PO, branch receives |
| Role-based access per store | Branch manager sees only their store |
| Consolidated GST filing | All stores in one report |

### 7.5 Future Vision (Phase 3+)

| Feature | Description |
|---------|-------------|
| Distributor ordering | Order directly from distributors inside PharmaCare |
| Drug recall alerts | CDSCO issues recall → system flags affected batches instantly |
| Patient medication history | Prescription tracking per patient |
| Insurance claim support | Ayushman Bharat, CGHS integration |
| Mobile app | Owner dashboard on phone |
| API for integrations | Connect with hospital HIS, lab systems |

---

## 8. WHAT WE ARE NOT BUILDING

Clarity on non-goals is as important as goals. These are explicitly out of scope:

- ❌ A general-purpose ERP (we are pharmacy-specific, always)
- ❌ Accounting software (we generate reports for accountants, we don't replace Tally)
- ❌ Doctor practice management (we connect with doctors, we don't manage their clinic)
- ❌ Wholesale distribution management (Phase 3 may touch this, not before)
- ❌ Hospital HIS (we integrate, we don't replace)
- ❌ A customizable platform (opinionated defaults, not endless configuration)

---

## 9. SUCCESS METRICS

### 9.1 North Star Metric
**Bills processed per day per pharmacy** — if this number grows, everything is working.

### 9.2 Product Health Metrics

| Metric | Target |
|--------|--------|
| Time to first bill (new user) | < 10 minutes from signup |
| Bill creation time | < 60 seconds for a 5-item bill |
| Search response time | < 300ms |
| System uptime | 99.9% |
| GST report generation | < 5 seconds |
| Schedule H1 register accuracy | 100% — zero tolerance for errors |

### 9.3 Business Metrics

| Metric | Description |
|--------|-------------|
| Pharmacies onboarded | Total active pharmacies |
| Bills per pharmacy per month | Engagement depth |
| Churn rate | Pharmacies who stop using |
| NPS | Would you recommend to another pharmacist? |
| Support tickets per pharmacy | Lower = better product |

---

## 10. COMPETITIVE LANDSCAPE

| Product | Strength | Weakness | Our edge |
|---------|----------|----------|----------|
| **Busy** | Accounting depth, trusted brand | Complex UI, not pharmacy-specific | Modern UX, pharmacy-first |
| **Marg ERP** | Pharma-specific, widely used | Windows-only, outdated UI | Web-based, mobile-ready |
| **WinPOS** | Affordable | Very basic, no GST depth | Full compliance, full insight |
| **PharmaERP** | Enterprise features | Expensive, needs IT support | Self-serve, no IT needed |
| **Excel/Paper** | Free, familiar | No compliance, no insight | One migration away |

**Our moat:** The combination of modern UX + India-specific compliance + batch-level tracking + no-training-needed simplicity. No one else has all four.

---

## 11. TECHNOLOGY DECISIONS (summary — see ARCHITECTURE.md for full detail)

| Decision | Choice | Reason |
|----------|--------|--------|
| Frontend | React + Tailwind + Shadcn/UI | Fast development, consistent UI, no custom CSS |
| Backend | FastAPI + SQLAlchemy | Async, typed, Python ecosystem |
| Database | PostgreSQL | ACID compliance, critical for financial data |
| Auth | JWT | Stateless, scales to multi-store |
| Money | Integer paise (₹1 = 100 paise) | Never floats for currency — financial accuracy |
| Deletes | Soft only | Pharmacy data is legal data — never hard delete |
| Bill numbers | DB sequence (nextval) | Atomic, no duplicates, audit-safe |

---

## 12. OPEN QUESTIONS & DECISIONS PENDING

These are known unknowns — logged here so they don't get forgotten.

| Question | Context | Priority |
|----------|---------|----------|
| Pricing model | Subscription vs per-bill vs freemium? | High |
| Mobile app timeline | Owners want phone access — native or PWA? | Medium |
| Offline support | Pharmacies in Tier 3 have unreliable internet | Medium |
| Data residency | Indian regulations may require India-hosted data | High |
| WhatsApp integration | Bill on WhatsApp is expected by patients | Low |
| Barcode scanner hardware | Recommend specific hardware or be hardware-agnostic? | Low |

---

*This document is owned by the founder and updated with every major product decision.*
*For component rules → see docs/06_COMPONENTS.md*
*For architecture decisions → see docs/08_ARCHITECTURE.md*
*For what's being built right now → see docs/15_ROADMAP.md*
