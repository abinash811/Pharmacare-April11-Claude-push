/**
 * useSettings — manages general settings and bill sequence state.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

const DEFAULT_SETTINGS = {
  inventory: { near_expiry_days: 30, block_expired_stock: true, allow_near_expiry_sale: true, low_stock_alert_enabled: true },
  billing:   { enable_draft_bills: true, auto_print_invoice: false },
  returns:   { return_window_days: 7, allow_partial_return: true },
  general:   { name: '', address: '', city: '', state: '', pincode: '', phone: '', email: '', gstin: '', drug_license_number: '', drug_license_expiry: '', fssai_number: '', pan_number: '', logo_url: '' },
  print:     { print_logo: true, print_drug_license: true, print_patient_name: true, print_gstin: true, print_fssai: false, print_signature: false, bill_header: '', bill_footer: 'Thank you for your purchase!' },
  gst:           { default_gst_rate: 5, default_hsn_medicines: '3004', default_hsn_surgical: '9018', auto_apply_hsn: true, gst_type: 'intrastate', round_off_amount: true, print_gst_summary: true },
  notifications: { alert_low_stock_enabled: true, alert_near_expiry_enabled: true, alert_drug_license_enabled: true, low_stock_threshold_days: 30, near_expiry_days: 90, drug_license_alert_days: 90 },
};

// Some settings are shown in two tabs on purpose (Inventory groups "rules"
// together, Notifications groups "alerts" with live toast previews) but
// both map to the same PharmacySettings column on the backend. Found Sep
// 28, 2026 (docs/15_ROADMAP.md RULE MISSES LOG): saveSettings always PUTs
// the WHOLE settings object, so editing only one tab's copy left the other
// tab's stale cached value riding along in the same request — the backend
// applies inventory's section then notifications' in a fixed order
// (routers/settings.py update_settings), so notifications' stale value
// silently overwrote whatever was just changed on Inventory, no matter
// which tab the user actually edited. updateSetting below keeps both
// copies of local state in sync the moment either is edited, so by save
// time they always agree and which section the backend processes last no
// longer matters. low_stock_threshold_days is also duplicated in both
// sections' shape but isn't editable from any control today
// (NotificationsTab.tsx deliberately removed its own UI for it — see that
// file's comment) so it's excluded here; add it if a control for it ever
// comes back.
const MIRRORED_FIELDS = [
  { a: ['inventory', 'near_expiry_days'], b: ['notifications', 'near_expiry_days'] },
  { a: ['inventory', 'low_stock_alert_enabled'], b: ['notifications', 'alert_low_stock_enabled'] },
];

export function useSettings() {
  const [settings,        setSettings]        = useState(DEFAULT_SETTINGS);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [billSequences,   setBillSequences]   = useState([]);
  const [sequenceLoading, setSequenceLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get(apiUrl.settings());
      setSettings(res.data);
    } catch {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSettings = useCallback(async (current) => {
    setSaving(true);
    try {
      await api.put(apiUrl.settings(), current);
      toast.success('Settings saved successfully');
    } catch (error) {
      // error.message is already normalised by the axios interceptor —
      // it names the field and reason for a 422, or says the server was
      // unreachable, rather than a generic "failed" with no cause.
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, []);

  const fetchBillSequences = useCallback(async () => {
    setSequenceLoading(true);
    try {
      const res = await api.get(apiUrl.billSequences());
      // GET /settings/bill-sequence/all returns a bare array, not { sequences: [...] }
      setBillSequences(res.data || []);
    } catch {
      console.error('Failed to load bill sequences');
    } finally {
      setSequenceLoading(false);
    }
  }, []);

  const saveBillSequence = useCallback(async (form) => {
    try {
      await api.put(apiUrl.billSequence(), form);
      toast.success('Bill sequence settings updated successfully');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to update sequence');
      return false;
    }
  }, []);

  const updateSetting = useCallback((section, key, value) => {
    setSettings(prev => {
      let next = { ...prev, [section]: { ...prev[section], [key]: value } };
      for (const { a, b } of MIRRORED_FIELDS) {
        const [aSection, aKey] = a;
        const [bSection, bKey] = b;
        if (section === aSection && key === aKey) {
          next = { ...next, [bSection]: { ...next[bSection], [bKey]: value } };
        } else if (section === bSection && key === bKey) {
          next = { ...next, [aSection]: { ...next[aSection], [aKey]: value } };
        }
      }
      return next;
    });
  }, []);

  return {
    settings, loading, saving,
    billSequences, sequenceLoading,
    fetchSettings, saveSettings,
    fetchBillSequences, saveBillSequence,
    updateSetting,
  };
}
