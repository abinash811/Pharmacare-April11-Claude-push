#!/usr/bin/env python3
"""check_doc_status_claims.py — warns when an acceptance-spec doc claims a
use-case is "Missing"/"Broken" but quotes an endpoint that actually exists.

Why this exists: Sep 24, 2026 RULE MISSES LOG — the 4th same-shaped miss
in one day. docs/23_PURCHASES_ACCEPTANCE_SPEC.md's UC-P09 ("Correct a
confirmed purchase — ❌ Missing") and UC-P31 ("Edit or reverse payment —
❌ Missing entirely") were both stale: `PUT /purchases/{id}/correct` and
the payment-reversal endpoint were fully built, tested, and wired to the
frontend — the doc's own "Batch 4" section near the bottom already said
so, but the earlier per-UC rows were never updated to match. Trusting the
per-UC row (not the whole doc) led to nearly building a second, conflicting
implementation before a router grep caught it. The GST report and
stock-adjust-permission misses earlier the same day were the same shape.

What this catches: a "Missing"/"Broken" UC row that names a specific HTTP
route in backticks, where that exact route already has a real handler in
backend/routers/*.py. It can only fire when the doc quotes a route,
which most confirmed-missing rows don't (there's nothing to quote) — so
it stays low-noise by design, not because the problem is rare.

What this can't catch: a "Missing" claim with no quoted route (most of
them) — that's still a real re-verify-before-building habit, not
something a script can substitute for. This script is one guardrail, not
the whole rule 14 discipline.

Usage: python3 scripts/check_doc_status_claims.py
Exit code is always 0 — informational only (see design-guard.sh's NOTE-
style rules for the precedent; a prose doc has too many legitimate
"missing" hits to safely hard-fail a commit on this alone).
"""
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DOCS = [
    REPO_ROOT / "docs" / "23_PURCHASES_ACCEPTANCE_SPEC.md",
    REPO_ROOT / "docs" / "24_REPORTS_ACCEPTANCE_SPEC.md",
]
ROUTERS_DIR = REPO_ROOT / "backend" / "routers"

UC_HEADING_RE = re.compile(r"^###\s+(UC-\S+):.*?(❌ Missing|🐛 Broken|🐛 Completely broken)", re.IGNORECASE)
ROUTE_RE = re.compile(r"`(GET|POST|PUT|PATCH|DELETE)\s+(/[^`]+)`")
# Turns "/purchases/{id}/correct" into a regex matching the same path with
# any FastAPI param name in the {..} slots, e.g. {purchase_id}.
PATH_PARAM_RE = re.compile(r"\{[^}]+\}")


def _route_pattern(path: str) -> re.Pattern:
    escaped = re.escape(path)
    flexible = PATH_PARAM_RE.sub(lambda m: r"\{[^}]+\}", escaped.replace(re.escape("{id}"), r"\{[^}]+\}"))
    # re.escape already escaped the braces from PATH_PARAM_RE's own match,
    # so just generalize any literal {something} back to a wildcard.
    flexible = re.sub(r"\\\{[^}]*\\\}", r"\\{[^}]+\\}", escaped)
    return re.compile(flexible)


def _router_source() -> str:
    text = ""
    for f in sorted(ROUTERS_DIR.glob("*.py")):
        text += f"\n# --- {f.name} ---\n" + f.read_text(errors="ignore")
    return text


def main() -> int:
    router_src = _router_source()
    hits = []

    for doc_path in DOCS:
        if not doc_path.exists():
            continue
        lines = doc_path.read_text(errors="ignore").splitlines()
        current_uc = None
        for i, line in enumerate(lines):
            m = UC_HEADING_RE.match(line)
            if m:
                current_uc = m.group(1)
                continue
            if current_uc and line.startswith("###"):
                current_uc = None  # left the UC's own body
                continue
            if not current_uc:
                continue
            for method, path in ROUTE_RE.findall(line):
                pattern = _route_pattern(path)
                decorator = f'@router.{method.lower()}('
                if decorator in router_src and pattern.search(router_src):
                    hits.append((doc_path.name, current_uc, method, path))

    if hits:
        print("check_doc_status_claims.py — possible stale 'Missing'/'Broken' doc claims:")
        for doc_name, uc, method, path in hits:
            print(f"  {doc_name} {uc}: claims missing/broken, but {method} {path} "
                  f"has a real handler in backend/routers/ — re-verify before trusting this row.")
    else:
        print("check_doc_status_claims.py — no quoted-route claims contradicted by real code.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
