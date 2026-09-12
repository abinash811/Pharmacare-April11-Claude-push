#!/usr/bin/env python3
"""check_error_messages.py — warns when a caught error's toast.error(...)
shows a hardcoded generic message instead of the real reason.

Why this exists: CLAUDE.md rule 10 ("every error notification must say
why") was violated twice in the same session (Sep 12, 2026) in files
being actively edited — useReports.js and useDashboard.js both had
`toast.error('Failed to load report')`/`toast.error('Failed to load
dashboard data')` inside a `catch (error)` block, discarding the real,
already-normalised `error.message` (lib/axios.js's interceptor) in favor
of a fixed string that tells the user nothing about what actually failed.
Caught only because the user asked to double-check, not by any tooling —
this script is that tooling, closing the gap per the RULE MISSES LOG
process (docs/15_ROADMAP.md) rather than leaving it to depend on memory.

Heuristic (deliberately conservative, warn-only — see design-guard.sh's
own Rule 11/12 precedent for the same class of "can't be 100% precise"
check): for every `catch (name)` block, if its body contains a
`toast.error(...)` call whose argument does not reference `name.message`
anywhere in the call, flag it. A `// error-reason-fixed: <why>` comment
on the same line (mirroring check_tenant_isolation.py's `# tenant-safe:`
marker) marks a reviewed, deliberate exception — e.g. a message that is
already maximally specific for a known cause (a 401, a client-side-only
validation with no server round trip).

This intentionally does NOT flag every toast.error(...) — only ones
inside a catch block, since a plain validation message elsewhere (e.g.
"No data to export") already states its own real, specific reason and
isn't hiding a caught exception.

Usage: python3 scripts/check_error_messages.py
Exit 0 = no unreviewed hardcoded-only error toast found.
Exit 1 = at least one found (prints file:line).
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"

SAFE_MARKER = "error-reason-fixed:"
CATCH_RE = re.compile(r"\bcatch\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*\{")
TOAST_ERROR_RE = re.compile(r"toast\.error\(")


def _find_matching_close(source: str, open_idx: int) -> int | None:
    depth = 0
    for i in range(open_idx, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                return i
    return None


def check_file(path: Path) -> list[str]:
    violations = []
    source = path.read_text()
    lines = source.split("\n")

    for m in CATCH_RE.finditer(source):
        var_name = m.group(1)
        open_idx = source.index("{", m.end() - 1)
        close_idx = _find_matching_close(source, open_idx)
        if close_idx is None:
            continue
        block = source[open_idx:close_idx + 1]

        for tm in TOAST_ERROR_RE.finditer(block):
            call_start = tm.end() - 1
            call_end = _find_matching_close_paren(block, call_start)
            if call_end is None:
                continue
            call_text = block[tm.start():call_end + 1]
            arg = call_text[len("toast.error("):-1].strip()
            # A bare identifier (not a string/template literal) is a
            # variable that may already hold a real, derived reason (e.g.
            # `const message = getErrorMessage(err, fallback)` computed
            # just above) — this heuristic can't trace that data flow, so
            # only flag calls whose argument is directly a literal.
            if not (arg.startswith("'") or arg.startswith('"') or arg.startswith("`")):
                continue
            # A real reason is shown either via the axios interceptor's
            # normalised `.message` (lib/axios.js), or by reading the raw
            # backend `detail` off the response directly — both are
            # legitimate, pre-existing patterns in this codebase.
            if f"{var_name}.message" in call_text or f"{var_name}?.message" in call_text:
                continue
            if "response?.data?.detail" in call_text or "response.data.detail" in call_text:
                continue
            abs_pos = open_idx + tm.start()
            line_no = source.count("\n", 0, abs_pos) + 1
            line_text = lines[line_no - 1] if line_no <= len(lines) else ""
            prev_line = lines[line_no - 2] if line_no >= 2 else ""
            if SAFE_MARKER in line_text or SAFE_MARKER in prev_line:
                continue
            snippet = " ".join(call_text.split())[:100]
            violations.append(f"{path.relative_to(REPO_ROOT)}:{line_no}: {snippet}")

    return violations


def _find_matching_close_paren(source: str, open_idx: int) -> int | None:
    depth = 0
    for i in range(open_idx, len(source)):
        if source[i] == "(":
            depth += 1
        elif source[i] == ")":
            depth -= 1
            if depth == 0:
                return i
    return None


def main() -> int:
    if not FRONTEND_SRC.exists():
        print(f"SKIP: {FRONTEND_SRC} not found")
        return 0

    all_violations = []
    for ext in ("*.js", "*.jsx", "*.ts", "*.tsx"):
        for path in sorted(FRONTEND_SRC.rglob(ext)):
            if "__tests__" in path.parts or path.name.endswith((".test.js", ".test.jsx", ".test.ts", ".test.tsx")):
                continue
            all_violations.extend(check_file(path))

    if not all_violations:
        print("Error message check: OK — every caught-error toast shows the real "
              "reason (or is explicitly marked // error-reason-fixed:).")
        return 0

    print("Error message check: found hardcoded-only error toasts")
    print()
    print("Each of these is inside a `catch (error)` block but shows a fixed")
    print("string instead of error.message (CLAUDE.md rule 10) — the user sees")
    print("no indication of what actually failed. Fix by adding")
    print("`error.message || '<fallback>'`, or mark it")
    print("`// error-reason-fixed: <why the fixed message is already correct>`")
    print("if the fixed message is deliberately more specific than error.message")
    print("would be (e.g. a known-cause branch).")
    print()
    for v in all_violations:
        print(f"  {v}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
