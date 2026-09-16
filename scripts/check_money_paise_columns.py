#!/usr/bin/env python3
"""check_money_paise_columns.py — fails if a `*_paise`-named database column
is not stored as an Integer.

Why this exists: CLAUDE.md Manifesto rule 5 ("Money is integer paise.
Always. Never floats for currency calculations.") is a written rule with
no automated check behind it — the same "manual habit, not tooling" gap
already found (and closed) for tenant isolation, permissions, and audit
logging. A `*_paise` column typed as Float/Numeric instead of Integer
would silently reintroduce the exact rounding-error risk the paise
convention exists to prevent, and nothing short of a human reading every
model definition would ever catch it.

Flags: any SQLAlchemy 2.0 `Mapped[...]` column declaration in
backend/models/*.py whose attribute name ends in `_paise` but whose
`mapped_column(...)` type is not `Integer` (or bare, i.e. relying on the
`Mapped[int]` annotation with no explicit column type, which SQLAlchemy
resolves to Integer).

This is deliberately narrow — a schema-level check, not an arithmetic
one. It can't (and doesn't try to) catch a float literal used in a paise
calculation at the point of use (e.g. `price_paise * 1.18`); that class of
bug has already been assessed twice in docs/15_ROADMAP.md's RULE MISSES
LOG as unsafe to lint (real percentage/ratio math looks identical to a
real bug without type information a static check doesn't have here). The
column-type check below has no such ambiguity: a `*_paise` column is
money by naming convention alone, and Integer is the one correct type for
it, full stop.

Usage: python3 scripts/check_money_paise_columns.py
Exit 0 = every `*_paise` column is Integer.
Exit 1 = at least one `*_paise` column uses a non-Integer type (prints file:line).
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = REPO_ROOT / "backend" / "models"

# `name: Mapped[int] = mapped_column(<TYPE>, ...)` or `Mapped[int | None]` —
# capture the attribute name and the mapped_column(...) call's own text.
COLUMN_RE = re.compile(
    r"^\s*([A-Za-z_][A-Za-z0-9_]*_paise)\s*:\s*Mapped\[[^\]]*\]\s*=\s*mapped_column\((.*)$"
)
DISALLOWED_TYPES = ("Float", "Numeric", "DECIMAL", "REAL", "DOUBLE_PRECISION", "Double")


def _extend_to_close_paren(source_lines: list[str], start_idx: int, start_col_text: str) -> str:
    """mapped_column(...) can wrap onto following lines — join lines until
    parens balance."""
    text = start_col_text
    depth = text.count("(") - text.count(")")
    idx = start_idx
    while depth > 0 and idx + 1 < len(source_lines):
        idx += 1
        text += "\n" + source_lines[idx]
        depth += source_lines[idx].count("(") - source_lines[idx].count(")")
    return text


def check_file(path: Path) -> list[str]:
    violations = []
    lines = path.read_text().split("\n")

    for i, line in enumerate(lines):
        m = COLUMN_RE.match(line)
        if not m:
            continue
        col_name, rest = m.group(1), m.group(2)
        full_call = _extend_to_close_paren(lines, i, rest)
        if any(t in full_call for t in DISALLOWED_TYPES):
            violations.append(f"{path.relative_to(REPO_ROOT)}:{i + 1}: `{col_name}` is not an Integer column")

    return violations


def main() -> int:
    if not MODELS_DIR.exists():
        print(f"SKIP: {MODELS_DIR} not found")
        return 0

    all_violations = []
    for path in sorted(MODELS_DIR.glob("*.py")):
        all_violations.extend(check_file(path))

    if not all_violations:
        print("Money-paise column check: OK — every *_paise column is Integer.")
        return 0

    print("Money-paise column check: FAILED")
    print()
    print("CLAUDE.md Manifesto rule 5: money is integer paise, always — a")
    print("*_paise column must be Integer, never Float/Numeric/DECIMAL. A")
    print("non-integer money column silently reintroduces rounding-error risk")
    print("in every calculation that reads it.")
    print()
    for v in all_violations:
        print(f"  {v}")
    print()
    return 1


if __name__ == "__main__":
    sys.exit(main())
