#!/usr/bin/env bash
# design-guard.sh — PharmaCare design system enforcement
# Runs in CI and pre-commit. Exits 1 if any violation found.
# Rules mirror CLAUDE.md component audit checklist.
#
# Usage: bash scripts/design-guard.sh
# Make executable first: chmod +x scripts/design-guard.sh

set -euo pipefail

FRONTEND="frontend/src/pages"
SHARED="frontend/src/components"
ERRORS=0

red()   { echo -e "\033[0;31m✗ $*\033[0m"; }
green() { echo -e "\033[0;32m✓ $*\033[0m"; }
warn()  { echo -e "\033[0;33m  $*\033[0m"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PharmaCare Design Guard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Rule 1: No raw <button> tags in pages (AppButton only) ───────────────
# Excludes: dropdown menu items inside popovers (known exceptions in BillingHeader)
# Excludes: WelcomeCard navigational tiles (intentional exception, documented)
RAW_BUTTONS=$(grep -rn "<button" "$FRONTEND" --include="*.jsx" --include="*.js" \
  | grep -v "data-testid=\"save-print-menu-btn\"" \
  | grep -v "WelcomeCard" \
  | grep -v "// raw button" \
  | wc -l | tr -d ' ')

if [ "$RAW_BUTTONS" -gt "0" ]; then
  red "Rule 1 FAIL: $RAW_BUTTONS raw <button> tag(s) found in pages/"
  grep -rn "<button" "$FRONTEND" --include="*.jsx" --include="*.js" \
    | grep -v "data-testid=\"save-print-menu-btn\"" \
    | grep -v "WelcomeCard" \
    | grep -v "// raw button" \
    | while read -r line; do warn "$line"; done
  ERRORS=$((ERRORS + 1))
else
  green "Rule 1 PASS: No raw <button> tags in pages"
fi

# ── Rule 2: No hardcoded hex colors in className ────────────────────────
HEX_COLORS=$(grep -rn "className=.*#[0-9a-fA-F]\{3,6\}" "$FRONTEND" "$SHARED" \
  --include="*.jsx" --include="*.js" \
  | grep -v "AuthPage" \
  | wc -l | tr -d ' ')

if [ "$HEX_COLORS" -gt "0" ]; then
  red "Rule 2 FAIL: $HEX_COLORS hardcoded hex color(s) in className"
  grep -rn "className=.*#[0-9a-fA-F]\{3,6\}" "$FRONTEND" "$SHARED" \
    --include="*.jsx" --include="*.js" \
    | grep -v "AuthPage" \
    | while read -r line; do warn "$line"; done
  ERRORS=$((ERRORS + 1))
else
  green "Rule 2 PASS: No hardcoded hex in className"
fi

# ── Rule 3: No hover:bg-[#...] patterns ─────────────────────────────────
HOVER_HEX=$(grep -rn "hover:bg-\[#" "$FRONTEND" "$SHARED" \
  --include="*.jsx" --include="*.js" | wc -l | tr -d ' ')

if [ "$HOVER_HEX" -gt "0" ]; then
  red "Rule 3 FAIL: $HOVER_HEX hover:bg-[#...] pattern(s) found"
  grep -rn "hover:bg-\[#" "$FRONTEND" "$SHARED" --include="*.jsx" --include="*.js" \
    | while read -r line; do warn "$line"; done
  ERRORS=$((ERRORS + 1))
else
  green "Rule 3 PASS: No hover:bg-[#...] patterns"
fi

# ── Rule 4: No files over 300 lines in pages/ ────────────────────────────
LONG_FILES=0
while IFS= read -r -d '' file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt 300 ]; then
    red "Rule 4 FAIL: $file has $lines lines (max 300)"
    LONG_FILES=$((LONG_FILES + 1))
  fi
done < <(find "$FRONTEND" -name "*.jsx" -o -name "*.js" | grep -v node_modules | tr '\n' '\0')

if [ "$LONG_FILES" -eq "0" ]; then
  green "Rule 4 PASS: All files under 300 lines"
else
  ERRORS=$((ERRORS + LONG_FILES))
fi

# ── Rule 5: No Shadcn <Button> imported in pages ─────────────────────────
SHADCN_BUTTON=$(grep -rn "from '@/components/ui/button'" "$FRONTEND" \
  --include="*.jsx" --include="*.js" | wc -l | tr -d ' ')

if [ "$SHADCN_BUTTON" -gt "0" ]; then
  red "Rule 5 FAIL: $SHADCN_BUTTON page(s) import directly from ui/button — use AppButton from shared"
  grep -rn "from '@/components/ui/button'" "$FRONTEND" \
    --include="*.jsx" --include="*.js" \
    | while read -r line; do warn "$line"; done
  ERRORS=$((ERRORS + 1))
else
  green "Rule 5 PASS: No direct ui/button imports in pages"
fi

# ── Rule 6: No new .jsx files — use .tsx ─────────────────────────────────
NEW_JSX=$(git diff --name-only --cached 2>/dev/null | grep "\.jsx$" | grep -v node_modules | wc -l | tr -d ' ')

if [ "$NEW_JSX" -gt "0" ]; then
  red "Rule 6 FAIL: $NEW_JSX new .jsx file(s) staged — use .tsx instead"
  git diff --name-only --cached 2>/dev/null | grep "\.jsx$" | while read -r line; do warn "$line"; done
  ERRORS=$((ERRORS + 1))
else
  green "Rule 6 PASS: No new .jsx files staged"
fi

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -eq "0" ]; then
  echo -e "\033[0;32m  ✓ All checks passed\033[0m"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
else
  echo -e "\033[0;31m  ✗ $ERRORS violation(s) found — fix before merging\033[0m"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 1
fi
