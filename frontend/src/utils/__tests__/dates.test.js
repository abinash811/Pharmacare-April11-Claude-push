// Found Sep 19, 2026: `.toISOString().split('T')[0]` converts to UTC
// before formatting, so for any timezone AHEAD of UTC — India, UTC+5:30,
// this product's entire market — a locally-picked date silently shifts
// back a day (a date-picker selection is always local midnight, which is
// always the previous day once converted to UTC when the local zone is
// ahead of it). This was copy-pasted into ~20 real call sites across the
// app — GST Report's own date range, Day-End Closing, Schedule H1
// Register, Purchase's stored purchase_date/due_date — before being fixed
// the same day. See docs/15_ROADMAP.md RULE MISSES LOG, Sep 19, 2026.
//
// This suite can't force a real IST runtime here (jsdom/V8 lock in the
// process's timezone at first Date use during Jest's own environment
// bootstrap, before a test file's own `process.env.TZ` override runs) —
// so instead of simulating IST directly, it asserts the actual invariant
// that makes toISODate immune to the bug regardless of runner timezone:
// it must return the same calendar day the Date object represents
// LOCALLY (getFullYear/getMonth/getDate), never a UTC-converted one.
import { toISODate, today } from '../dates';

describe('toISODate — timezone safety', () => {
  it('returns the same calendar day it was given, read from local date parts', () => {
    const pickedSep19 = new Date(2026, 8, 19);
    const expected = `${pickedSep19.getFullYear()}-${String(pickedSep19.getMonth() + 1).padStart(2, '0')}-${String(pickedSep19.getDate()).padStart(2, '0')}`;
    expect(toISODate(pickedSep19)).toBe(expected);
    expect(toISODate(pickedSep19)).toBe('2026-09-19');
  });

  it('is correct across a full month of local-midnight dates, not just one', () => {
    for (let day = 1; day <= 28; day++) {
      const d = new Date(2026, 8, day);
      const expected = `2026-09-${String(day).padStart(2, '0')}`;
      expect(toISODate(d)).toBe(expected);
    }
  });

  it('handles a date range end-of-day too (23:59 local)', () => {
    const d = new Date(2026, 8, 19, 23, 59, 59);
    expect(toISODate(d)).toBe('2026-09-19');
  });
});

describe('today() — timezone safety', () => {
  it('matches the real local calendar date, not a UTC-shifted one', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(today()).toBe(expected);
  });
});
