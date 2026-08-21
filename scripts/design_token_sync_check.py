#!/usr/bin/env python3
"""design_token_sync_check.py — fails if the design system reference file
(PharmaCare Design System/colors_and_type.css) disagrees with the real,
running app (frontend/tailwind.config.js) about a token's value.

Why this exists: motion tokens drifted between these two files for months
(colors_and_type.css specified a 7-duration scale that was never wired into
Tailwind at all) before being caught by chance in conversation, not by any
automated check. This makes that class of bug structurally impossible to
reintroduce silently — a value mismatch fails CI and pre-commit instead of
waiting to be noticed.

Add a new row to TOKEN_MAP below whenever a new token is added to either
file. Values are compared with all whitespace stripped (cosmetic spacing
differences, e.g. "rgba(70,130,180,0.10)" vs "rgba(70, 130, 180, 0.10)",
are not a real disagreement).

Usage: python3 scripts/design_token_sync_check.py
Exit 0 = in sync. Exit 1 = at least one token disagrees (prints which).
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TAILWIND_CONFIG = REPO_ROOT / "frontend" / "tailwind.config.js"
DESIGN_CSS = REPO_ROOT / "PharmaCare Design System" / "colors_and_type.css"

# (description, tailwind.config.js key regex, CSS custom property name)
TOKEN_MAP = [
    ("brand color",           r"DEFAULT:\s*'([^']+)'",  "--brand"),
    ("brand-dark color",      r"dark:\s*'([^']+)'",     "--brand-dark"),
    ("brand-tint color",      r"tint:\s*'([^']+)'",     "--brand-tint"),
    ("brand-subtle color",    r"subtle:\s*'([^']+)'",   "--brand-subtle"),
    ("page background",       r"'page':\s*'([^']+)'",   "--bg-app"),
    ("sidebar background",    r"'sidebar':\s*'([^']+)'","--sidebar-bg"),
    ("duration-fast",         r"fast:\s*'([^']+)'",     "--duration-fast"),
    ("duration-base",         r"base:\s*'([^']+)'",     "--duration-base"),
    ("duration-slow",         r"slow:\s*'([^']+)'",     "--duration-slow"),
    ("duration-slower",       r"slower:\s*'([^']+)'",   "--duration-slower"),
    ("ease-out-smooth",       r"'ease-out-smooth':\s*'([^']+)'", "--ease-out-smooth"),
    ("ease-in-smooth",        r"'ease-in-smooth':\s*'([^']+)'",  "--ease-in-smooth"),
]


def normalize(value: str) -> str:
    return re.sub(r"\s+", "", value).rstrip(";").lower()


def extract_tailwind_value(source: str, key_pattern: str) -> str | None:
    match = re.search(key_pattern, source)
    return match.group(1) if match else None


def extract_css_value(source: str, var_name: str) -> str | None:
    match = re.search(rf"{re.escape(var_name)}:\s*([^;]+);", source)
    return match.group(1).strip() if match else None


def main() -> int:
    if not TAILWIND_CONFIG.exists():
        print(f"SKIP: {TAILWIND_CONFIG} not found")
        return 0
    if not DESIGN_CSS.exists():
        print(f"SKIP: {DESIGN_CSS} not found")
        return 0

    tailwind_src = TAILWIND_CONFIG.read_text()
    css_src = DESIGN_CSS.read_text()

    mismatches = []
    for label, tw_pattern, css_var in TOKEN_MAP:
        tw_value = extract_tailwind_value(tailwind_src, tw_pattern)
        css_value = extract_css_value(css_src, css_var)

        if tw_value is None or css_value is None:
            # A token missing from one side entirely is also real drift —
            # report it rather than silently skipping.
            mismatches.append((label, tw_value, css_value))
            continue

        if normalize(tw_value) != normalize(css_value):
            mismatches.append((label, tw_value, css_value))

    if not mismatches:
        print("Design token sync check: OK — tailwind.config.js and colors_and_type.css agree.")
        return 0

    print("Design token sync check: FAILED")
    print("tailwind.config.js (the real, running app) disagrees with")
    print("PharmaCare Design System/colors_and_type.css (the reference) on:")
    print()
    for label, tw_value, css_value in mismatches:
        print(f"  {label}:")
        print(f"    tailwind.config.js  = {tw_value!r}")
        print(f"    colors_and_type.css = {css_value!r}")
    print()
    print("tailwind.config.js is the source of truth (it's what actually ships) —")
    print("update colors_and_type.css (and any preview HTML that hardcodes the")
    print("same value) to match it, unless the change was meant to go the other way.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
