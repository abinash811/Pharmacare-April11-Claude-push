# PharmaCare — Support FAQ / Knowledge Base
# Version: 1.1 | Last updated: September 24, 2026
# Type: Reference

Structured like Intercom's Help Center (Abinash's choice, Sep 24, 2026):
one **module** → one or more **sub-modules** → plain-language Q&A per
real use case. Written for a support agent or a pharmacy owner, not a
developer — no jargon, no code references in the answer text itself.

**Source-of-truth rule:** every answer here must trace to real, verified
code or to another `docs/*.md` file — never re-derived from memory or
guessed. If a module below has no content yet, it says so; it does not
get a fabricated placeholder answer. Update this file in the same change
as the code change it describes (same discipline as every other doc —
CLAUDE.md rule 13).

**Status key:** ✅ Filled & verified · ⏳ Outline only, content pending

> ⚠️ **Known gap, ON HOLD (Abinash, Sep 24, 2026):** the Billing and
> Settings → Receipt & Print sections below were written answering "what
> does the system do/limit" (an internal capability-audit voice), not
> "how do I do my job" (a real end-user's voice). A proper rewrite is
> task-first — "How do I sell 2 loose tablets instead of the whole
> strip," "How do I split a payment across cash and card," step-by-step
> where it helps, for someone who's never opened the app — while keeping
> every underlying fact exactly as verified. **Do not start this rewrite
> until Abinash explicitly says to begin it** — this note is the record
> of the decision, not a green light to act on it.

---

## Contents

| Module | Status |
|---|---|
| [Billing](#billing) | ✅ |
| [Sales Returns](#sales-returns) | ⏳ |
| [Purchases](#purchases) | ⏳ |
| [Purchase Returns](#purchase-returns) | ⏳ |
| [Inventory](#inventory) | ⏳ |
| [Reports](#reports) | ⏳ |
| [Settings → Receipt & Print](#settings--receipt--print) | ✅ |
| [Settings — other tabs](#settings--other-tabs) | ⏳ |
| [Customers / Suppliers / Team](#customers--suppliers--team) | ⏳ |

---

## Billing

### Can I bill a medicine that's out of stock?

No. A medicine with zero stock can't be added to a bill — there's no
batch to sell from. It still **shows up when you search** for it (sorted
to the bottom, clearly marked "Out of stock") instead of disappearing —
that's deliberate, so you know it exists and can go restock it, rather
than wondering why it vanished.

### Can I sell the same medicine from two different batches on one bill?

Yes. Pick the medicine, choose a batch, add it — then search the same
medicine again and pick a different batch. It adds as a second line.
Picking the *same* medicine and *same* batch again just increases the
quantity on the existing line instead of duplicating it.

### How long can I edit a bill after creating it?

Same day, generally. A finalized (paid) bill locks forever the moment
either of these happens:
- A Sales Return has already been recorded against it, or
- That day's Day-End Closing has already been run.

After that, the only way to correct it is a Sales Return — never a
silent rewrite of the original bill.

### What payment methods are available?

Cash, UPI, Credit Card, Debit Card, and Multi (split across 2+ of the
above — e.g. ₹300 cash + ₹200 UPI). A bill must be **paid in full** to
finalize — there's no "due"/partial-balance option anymore (removed Sep
19, 2026): if the amount entered doesn't cover the total, the bill can't
be saved as paid.

> Bills created before Sep 24, 2026 may still show a plain "Card" or
> "Credit" label — those are historical records and are never rewritten;
> new bills always use Credit Card / Debit Card specifically.

### Is a Doctor required to create a bill?

Only for Schedule H1 drugs (the strictly controlled category — e.g.
certain antibiotics, sedatives). For those, the doctor's name **and** the
patient's address are legally required at the time of sale. For every
other medicine, Doctor is optional.

### Is a Customer required to create a bill?

No. Every bill defaults to "Walk-in Customer" if nothing is entered —
you're never blocked from billing for not having a customer on file.

### What's pre-filled when I start a new bill?

Walk-in Customer, today's date, and your pharmacy's default GST rate
(from Settings → Tax & GST). Everything else starts empty.

---

## Sales Returns

⏳ Not yet filled — see `docs/07_BUSINESS_LOGIC.md`'s Sales Returns
section for the verified source material (return window, partial
returns, refund methods, quantity caps) to convert into plain-language
Q&A here.

---

## Purchases

⏳ Not yet filled.

---

## Purchase Returns

⏳ Not yet filled.

---

## Inventory

⏳ Not yet filled.

---

## Reports

⏳ Not yet filled.

---

## Settings → Receipt & Print

This tab has **two independent formats** — changing one does not affect
the other:
- **Print** — the physical receipt (A4, A5, or thermal 80mm/58mm)
- **Digital** — the WhatsApp/digital copy sent to a customer

### How do I add my own header/footer text to printed bills?

Settings → Receipt & Print → Print format → **Header & Footer** section.
"Bill Header" is a free-text field (e.g. a tagline or extra address
line), "Bill Footer" is another (e.g. a thank-you message or return
policy). Both are optional and print exactly as typed, on every
physical bill regardless of paper size.

### Does that also change my WhatsApp/digital receipts?

No — Digital has its own separate header/footer, set under the same
tab's **Digital** format panel. The two are intentionally independent so
you can use different wording (or leave one blank) for print vs. digital.

### What else can I show or hide on a printed bill?

Under the same Print format panel's "Show on Bill" toggles: GSTIN, Drug
License No., FSSAI Number, PAN, Patient Name, and a Signature line
("Authorised Signatory" at the bottom). Each is an independent on/off
switch.

---

## Settings — other tabs

⏳ Not yet filled. Real tabs to cover next: Pharmacy Profile, Tax & GST,
Notifications, Inventory, Billing, Bill Sequence, Returns, Data & Backup.

---

## Customers / Suppliers / Team

⏳ Not yet filled.
