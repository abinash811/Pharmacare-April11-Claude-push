#!/usr/bin/env python3
"""eslint_changed_lines.py — run ESLint on given frontend files, but only
fail on issues that land on lines actually added/changed in the staged
diff. Same rationale as flake8_changed_lines.py in this same directory —
this repo has plenty of pre-existing lint debt in files that predate any
lint enforcement being wired up; blocking a commit on pre-existing issues
in an untouched part of a touched file isn't useful.

Usage: eslint_changed_lines.py <repo-relative-file> [<file> ...]
Paths must be relative to the repo root (e.g. frontend/src/App.js).
Exit code 0 if no NEW issues found, 1 otherwise (prints them).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(REPO_ROOT, "frontend")

HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def added_line_numbers(repo_relative_path: str) -> set[int]:
    diff = subprocess.run(
        ["git", "diff", "--cached", "-U0", "--", repo_relative_path],
        capture_output=True, text=True, check=False, cwd=REPO_ROOT,
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
    repo_relative_files = argv[1:]
    if not repo_relative_files:
        return 0

    # eslint.config.js lives in frontend/, so it must run with that cwd.
    frontend_relative_files = [
        f[len("frontend/"):] if f.startswith("frontend/") else f
        for f in repo_relative_files
    ]

    result = subprocess.run(
        ["./node_modules/.bin/eslint", *frontend_relative_files, "--format=json"],
        capture_output=True, text=True, check=False, cwd=FRONTEND_DIR,
    )

    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError:
        # eslint crashed or is misconfigured — surface it and fail closed.
        print(result.stderr or result.stdout)
        return 1

    added_by_file = {f: added_line_numbers(f) for f in repo_relative_files}

    new_issues = []
    for file_result in report:
        repo_relative = os.path.relpath(file_result["filePath"], REPO_ROOT)
        added = added_by_file.get(repo_relative, set())
        for msg in file_result.get("messages", []):
            if msg.get("line") in added:
                severity = "error" if msg.get("severity") == 2 else "warning"
                new_issues.append(
                    f"{repo_relative}:{msg.get('line')}:{msg.get('column')}: "
                    f"{severity} {msg.get('message')} ({msg.get('ruleId')})"
                )

    if new_issues:
        print("\n".join(new_issues))
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
