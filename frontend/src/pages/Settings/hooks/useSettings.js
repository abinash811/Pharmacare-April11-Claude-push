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
  general:   { pharmacy_name: 'PharmaCare', currency: 'INR', timezone: 'Asia/Kolkata' },
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
