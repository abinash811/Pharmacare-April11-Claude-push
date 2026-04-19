/**
 * PharmaCare — Feature Flags
 *
 * Lightweight config-based feature flags. No external service needed for Phase 1.
 *
 * HOW TO USE:
 *   import { useFlag } from '@/lib/featureFlags';
 *   const isEnabled = useFlag('commandPalette');
 *   if (isEnabled) { ... }
 *
 * HOW TO ADD A FLAG:
 *   1. Add key + default to FLAGS below
 *   2. Override per-environment with REACT_APP_FLAG_<KEY>=true env var
 *
 * HOW TO SHIP DARK (off by default, on in staging):
 *   Set REACT_APP_FLAG_COMMANDPALETTE=true in .env.staging
 */

export type FlagKey =
  | 'commandPalette'    // Cmd+K global search
  | 'speedKeys'         // n/f/Esc/Enter keyboard nav
  | 'sheets'            // Side-drawer forms (replaces centered modals)
  | 'bulkUpload'        // Excel bulk inventory upload
  | 'marginReport'      // Margin report UI
  | 'expiryAlerts';     // Expiry dashboard widget

/** Default values — what ships when no env override exists */
const DEFAULTS: Record<FlagKey, boolean> = {
  commandPalette: false,
  speedKeys:      false,
  sheets:         false,
  bulkUpload:     true,   // backend done, UI in progress
  marginReport:   false,
  expiryAlerts:   false,
};

/**
 * Read all flags — env vars override defaults.
 * REACT_APP_FLAG_COMMANDPALETTE=true → commandPalette: true
 */
function resolveFlags(): Record<FlagKey, boolean> {
  const flags = { ...DEFAULTS };

  (Object.keys(flags) as FlagKey[]).forEach((key) => {
    const envKey = `REACT_APP_FLAG_${key.toUpperCase()}`;
    const envVal = process.env[envKey];
    if (envVal === 'true')  flags[key] = true;
    if (envVal === 'false') flags[key] = false;
  });

  return flags;
}

const FLAGS = resolveFlags();

/** Read a single feature flag. */
export function getFlag(key: FlagKey): boolean {
  return FLAGS[key] ?? false;
}

/** React hook — same as getFlag but reads at render time. */
export function useFlag(key: FlagKey): boolean {
  return getFlag(key);
}

/** All resolved flags — useful for debugging. */
export function getAllFlags(): Record<FlagKey, boolean> {
  return { ...FLAGS };
}
