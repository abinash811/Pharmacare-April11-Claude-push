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
  returns:   { return_window_days: 7, require_original_bill: false, allow_partial_return: true },
  general:   { name: '', address: '', city: '', state: '', pincode: '', phone: '', email: '', gstin: '', drug_license_number: '', drug_license_expiry: '', fssai_number: '', pan_number: '', logo_url: '' },
  print:     { print_logo: true, print_drug_license: true, print_patient_name: true, print_gstin: true, print_fssai: false, print_signature: false, bill_header: '', bill_footer: 'Thank you for your purchase!' },
  gst:           { default_gst_rate: 5, is_composition_scheme: false, default_hsn_medicines: '3004', default_hsn_surgical: '9018', auto_apply_hsn: true, gst_type: 'intrastate', round_off_amount: true, print_gst_summary: true },
  notifications: { alert_low_stock_enabled: true, alert_near_expiry_enabled: true, alert_drug_license_enabled: true, low_stock_threshold_days: 30, near_expiry_days: 90, drug_license_alert_days: 90 },
};

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
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, []);

  const fetchBillSequences = useCallback(async () => {
    setSequenceLoading(true);
    try {
      const res = await api.get(apiUrl.billSequences());
      setBillSequences(res.data.sequences || []);
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
      toast.error(error.response?.data?.detail || 'Failed to update sequence');
      return false;
    }
  }, []);

  const updateSetting = useCallback((section, key, value) => {
    setSettings(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }, []);

  return {
    settings, loading, saving,
    billSequences, sequenceLoading,
    fetchSettings, saveSettings,
    fetchBillSequences, saveBillSequence,
    updateSetting,
  };
}
