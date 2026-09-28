import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../useSettings';

// Regression tests for the Sep 28, 2026 fix (docs/15_ROADMAP.md RULE MISSES
// LOG): near_expiry_days is editable from both the Inventory tab (a plain
// number input) and the Notifications tab (a DaysInput stepper) — same for
// low_stock_alert_enabled (Inventory checkbox) / alert_low_stock_enabled
// (Notifications toggle). Both pairs map to the same PharmacySettings
// column on the backend. Since saveSettings always PUTs the whole settings
// object, editing only one tab's copy used to leave the other tab's stale
// cached value riding along in the same request — the backend applies
// "notifications" after "inventory" in a fixed order, so notifications'
// stale value silently overwrote whatever was just changed on Inventory,
// no matter which tab the user actually edited. updateSetting now keeps
// both copies in sync the instant either is edited.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

describe('useSettings — mirrored field sync', () => {
  it('editing near_expiry_days on the inventory tab also updates the notifications copy', () => {
    const { result } = renderHook(() => useSettings());
    act(() => { result.current.updateSetting('inventory', 'near_expiry_days', 77); });

    expect(result.current.settings.inventory.near_expiry_days).toBe(77);
    expect(result.current.settings.notifications.near_expiry_days).toBe(77);
  });

  it('editing near_expiry_days on the notifications tab also updates the inventory copy', () => {
    const { result } = renderHook(() => useSettings());
    act(() => { result.current.updateSetting('notifications', 'near_expiry_days', 45); });

    expect(result.current.settings.notifications.near_expiry_days).toBe(45);
    expect(result.current.settings.inventory.near_expiry_days).toBe(45);
  });

  it('editing the low-stock-alert checkbox on inventory also flips the notifications toggle', () => {
    const { result } = renderHook(() => useSettings());
    act(() => { result.current.updateSetting('inventory', 'low_stock_alert_enabled', false); });

    expect(result.current.settings.inventory.low_stock_alert_enabled).toBe(false);
    expect(result.current.settings.notifications.alert_low_stock_enabled).toBe(false);
  });

  it('editing the low-stock-alert toggle on notifications also flips the inventory checkbox', () => {
    const { result } = renderHook(() => useSettings());
    act(() => { result.current.updateSetting('notifications', 'alert_low_stock_enabled', false); });

    expect(result.current.settings.notifications.alert_low_stock_enabled).toBe(false);
    expect(result.current.settings.inventory.low_stock_alert_enabled).toBe(false);
  });

  it('editing an unrelated field never touches other sections', () => {
    const { result } = renderHook(() => useSettings());
    const before = result.current.settings.notifications;
    act(() => { result.current.updateSetting('inventory', 'block_expired_stock', false); });

    expect(result.current.settings.inventory.block_expired_stock).toBe(false);
    expect(result.current.settings.notifications).toBe(before);
  });

  it('a saved payload always carries matching values for both mirrors, regardless of which tab was edited', () => {
    const { result } = renderHook(() => useSettings());
    act(() => { result.current.updateSetting('inventory', 'near_expiry_days', 77); });

    // This is exactly the object saveSettings PUTs — both sections must
    // already agree by this point, since the backend applies them in a
    // fixed order and would let the stale one win otherwise.
    expect(result.current.settings.inventory.near_expiry_days)
      .toBe(result.current.settings.notifications.near_expiry_days);
  });
});
