#!/bin/bash
# Shared gate for the Stop hook and the PreToolUse(git commit) hook.
#
# Why this exists: CLAUDE.md's design-guard.sh rules (including Rule 14,
# added Sep 12, 2026 after a real miss — see docs/15_ROADMAP.md RULE
# MISSES LOG) previously depended entirely on Claude remembering to run
# them before calling work done or committing. This makes that automatic:
# the harness runs this script itself, not Claude, so it can't be skipped
# by an oversight.
#
# Usage: design-guard-gate.sh <mode>
#   mode = "stop"       -> reads Stop hook stdin (checks stop_hook_active
#                          to avoid an infinite re-block loop), emits
#                          {"decision":"block","reason":...} on failure.
#   mode = "pretooluse" -> emits {"hookSpecificOutput":{"permissionDecision":"deny",...}}
#                          on failure, for gating `git commit` specifically.
#
# Always exits 0 — blocking is signaled via the JSON body, per Claude
# Code's documented hook output contract, not via a raw exit code.
set -uo pipefail

MODE="${1:-stop}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/home/user/Pharmacare-April11-Claude-push}"

INPUT="$(cat)"

if [ "$MODE" = "stop" ]; then
  STOP_ACTIVE="$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)"
  if [ "$STOP_ACTIVE" = "true" ]; then
    # Already blocked once this turn-chain — don't loop forever even if
    # design-guard.sh is still red; let Claude (or the user) take it from here.
    echo '{"continue": true}'
    exit 0
  fi
fi

cd "$PROJECT_DIR" || { echo '{"continue": true}'; exit 0; }

GUARD_OUTPUT="$(bash scripts/design-guard.sh 2>&1)"
GUARD_CODE=$?

if [ "$GUARD_CODE" -eq 0 ]; then
  echo '{"continue": true}'
  exit 0
fi

REASON_JSON="$(printf '%s' "$GUARD_OUTPUT" | jq -Rs .)"

if [ "$MODE" = "stop" ]; then
  printf '{"decision": "block", "reason": %s}\n' "$REASON_JSON"
else
  printf '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": %s}}\n' "$REASON_JSON"
fi
exit 0
