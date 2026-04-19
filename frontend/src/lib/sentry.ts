/**
 * Sentry — stub until @sentry/react is installed.
 *
 * These are safe no-ops. When you're ready to activate:
 *   1. Run: yarn add @sentry/react
 *   2. Set REACT_APP_SENTRY_DSN in your env
 *   3. Replace this file with the full implementation from docs/sentry-full.ts
 */

export function initSentry(): void {
  // No-op — @sentry/react not yet installed
}

export function captureError(
  _error: unknown,
  _context?: Record<string, unknown>,
): void {
  // No-op — @sentry/react not yet installed
}
