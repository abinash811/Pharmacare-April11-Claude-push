#!/usr/bin/env python3
"""flake8_changed_lines.py — run flake8 on given files, but only fail on
issues that land on lines actually added/changed in the staged diff.

Backend files in this repo have decades of pre-existing flake8 debt that
predates flake8 even being runnable here (it was missing from
requirements.txt until 2026-08). Blocking a commit on pre-existing issues
in an unrelated part of a touched file isn't useful — this mirrors the
same "staged files only, not the whole repo" philosophy already used
elsewhere in .githooks/pre-commit, one level more precise.

Usage: flake8_changed_lines.py <file> [<file> ...]
Exit code 0 if no NEW issues found, 1 otherwise (prints them).
"""
from __future__ import annotations

import re
import subprocess
import sys

HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def added_line_numbers(path: str) -> set[int]:
    diff = subprocess.run(
        ["git", "diff", "--cached", "-U0", "--", path],
        capture_output=True, text=True, check=False,
    ).stdout
    lines: set[int] = set()
    for line in diff.splitlines():
        m = HUNK_RE.match(line)
        if m:
            start = int(m.group(1))
            count = int(m.group(2)) if m.group(2) is not None else 1
            lines.update(range(start, start + count))
    return lines


def main(argv: list[str]) -> int:
    files = argv[1:]
    if not files:
        return 0

    result = subprocess.run(
        ["flake8", *files, "--max-line-length=100",
         "--exclude=venv,alembic/versions,__pycache__"],
        capture_output=True, text=True, check=False,
    )
    if result.returncode == 0:
        return 0

    added_by_file = {f: added_line_numbers(f) for f in files}

    new_issues = []
    for line in result.stdout.splitlines():
        m = re.match(r"^(.+?):(\d+):\d+:", line)
        if not m:
            continue
        path, lineno = m.group(1), int(m.group(2))
        if lineno in added_by_file.get(path, set()):
            new_issues.append(line)

    if new_issues:
        print("\n".join(new_issues))
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
