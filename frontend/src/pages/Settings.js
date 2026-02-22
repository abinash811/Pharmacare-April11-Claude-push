import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '@/App';
import { Save, Settings as SettingsIcon, Package, ShoppingCart, Globe, RotateCcw, Hash, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', disabled = false, type = 'button', className = '' }) => {
  const baseStyles = 'rounded font-medium transition-colors px-4 py-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'
  };
  
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export default function Settings() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  
  const [settings, setSettings] = useState({
    inventory: {
      near_expiry_days: 30,
      block_expired_stock: true,
      allow_near_expiry_sale: true,
      low_stock_alert_enabled: true
    },
    billing: {
      enable_draft_bills: true,
      auto_print_invoice: false
    },
    returns: {
      return_window_days: 7,
      require_original_bill: false,
      allow_partial_return: true
    },
    general: {
      pharmacy_name: 'PharmaCare',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    }
  });

  // Bill Sequence Settings
  const [billSequences, setBillSequences] = useState([]);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [editingSequence, setEditingSequence] = useState(null);
  const [sequenceForm, setSequenceForm] = useState({
    prefix: 'INV',
    starting_number: 1,
    sequence_length: 6,
    allow_prefix_change: true
  });
  const [previewNumber, setPreviewNumber] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'bill_sequence') {
      fetchBillSequences();
    }
  }, [activeTab]);

  useEffect(() => {
    // Update preview when form changes
    const preview = `${sequenceForm.prefix.toUpperCase()}-${String(sequenceForm.starting_number).padStart(sequenceForm.sequence_length, '0')}`;
    setPreviewNumber(preview);
  }, [sequenceForm]);

  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchBillSequences = async () => {
    setSequenceLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/settings/bill-sequences`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBillSequences(response.data.sequences || []);
    } catch (error) {
      console.error('Failed to load bill sequences');
    } finally {
      setSequenceLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    
    try {
      await axios.put(`${API}/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only administrators can access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Application Settings
        </h1>
        <p className="text-gray-600 mt-1">Configure pharmacy management system preferences</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'inventory'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Package className="w-5 h-5" />
              Inventory
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'billing'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              Billing
            </button>
            <button
              onClick={() => setActiveTab('bill_sequence')}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'bill_sequence'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              data-testid="bill-sequence-tab"
            >
              <Hash className="w-5 h-5" />
              Bill Sequence
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'returns'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              Returns
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'general'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Globe className="w-5 h-5" />
              General
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading settings...</p>
            </div>
          ) : (
            <>
              {/* Inventory Settings */}
              {activeTab === 'inventory' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Inventory Management Rules</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Near Expiry Alert (Days before expiry)
                        </label>
                        <input
                          type="number"
                          value={settings.inventory.near_expiry_days}
                          onChange={(e) => updateSetting('inventory', 'near_expiry_days', parseInt(e.target.value))}
                          className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded"
                          min="1"
                          max="365"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Products expiring within this period will be flagged as "Near Expiry"
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="block_expired"
                          checked={settings.inventory.block_expired_stock}
                          onChange={(e) => updateSetting('inventory', 'block_expired_stock', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="block_expired" className="text-sm font-medium text-gray-700">
                          Block expired stock from billing
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="allow_near_expiry"
                          checked={settings.inventory.allow_near_expiry_sale}
                          onChange={(e) => updateSetting('inventory', 'allow_near_expiry_sale', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="allow_near_expiry" className="text-sm font-medium text-gray-700">
                          Allow selling near-expiry products (with warning)
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="low_stock_alert"
                          checked={settings.inventory.low_stock_alert_enabled}
                          onChange={(e) => updateSetting('inventory', 'low_stock_alert_enabled', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="low_stock_alert" className="text-sm font-medium text-gray-700">
                          Enable low stock alerts on dashboard
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Settings */}
              {activeTab === 'billing' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Billing Preferences</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="draft_bills"
                          checked={settings.billing?.enable_draft_bills}
                          onChange={(e) => updateSetting('billing', 'enable_draft_bills', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="draft_bills" className="text-sm font-medium text-gray-700">
                          Enable draft bills (save without payment)
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="auto_print"
                          checked={settings.billing?.auto_print_invoice}
                          onChange={(e) => updateSetting('billing', 'auto_print_invoice', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="auto_print" className="text-sm font-medium text-gray-700">
                          Auto-print invoice after checkout
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Returns Settings */}
              {activeTab === 'returns' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Sales Returns Policy</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Return Window (Days)
                        </label>
                        <input
                          type="number"
                          value={settings.returns?.return_window_days || 7}
                          onChange={(e) => updateSetting('returns', 'return_window_days', parseInt(e.target.value))}
                          className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded"
                          min="1"
                          max="365"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Maximum days after purchase within which returns are accepted. A warning will be shown for returns after this period.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="require_original_bill"
                          checked={settings.returns?.require_original_bill || false}
                          onChange={(e) => updateSetting('returns', 'require_original_bill', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="require_original_bill" className="text-sm font-medium text-gray-700">
                          Require original bill for all returns
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="allow_partial_return"
                          checked={settings.returns?.allow_partial_return !== false}
                          onChange={(e) => updateSetting('returns', 'allow_partial_return', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="allow_partial_return" className="text-sm font-medium text-gray-700">
                          Allow partial returns (return some items from a bill)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bill Sequence Settings */}
              {activeTab === 'bill_sequence' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Bill Number Sequence Configuration</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Configure how bill numbers are auto-generated. Numbers are sequential and never reused.
                    </p>

                    {sequenceLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2">Loading sequences...</p>
                      </div>
                    ) : (
                      <>
                        {/* Current Sequences Table */}
                        <div className="mb-8">
                          <h4 className="font-medium text-gray-800 mb-3">Current Sequences</h4>
                          <div className="bg-gray-50 rounded-lg border overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Document Type</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prefix</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Used</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Next Number</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Format</th>
                                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {billSequences.length === 0 ? (
                                  <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                      No sequences configured. Default sequences will be created automatically.
                                    </td>
                                  </tr>
                                ) : (
                                  billSequences.map((seq, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{seq.document_type}</td>
                                      <td className="px-4 py-3">
                                        <span className="inline-flex px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-mono rounded">
                                          {seq.prefix}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600">
                                        {seq.current_sequence > 0 ? seq.current_sequence : 'Not used yet'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="text-sm font-mono text-green-600">
                                          {seq.prefix}-{String(seq.next_number).padStart(seq.sequence_length || 6, '0')}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-500">
                                        {seq.prefix}-{'0'.repeat(seq.sequence_length || 6)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <button
                                          onClick={() => {
                                            setEditingSequence(seq.prefix);
                                            setSequenceForm({
                                              prefix: seq.prefix,
                                              starting_number: seq.next_number,
                                              sequence_length: seq.sequence_length || 6,
                                              allow_prefix_change: seq.allow_prefix_change !== false
                                            });
                                          }}
                                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                          data-testid={`edit-sequence-${seq.prefix}`}
                                        >
                                          Configure
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Edit/Create Sequence Form */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                          <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                            <Hash className="w-5 h-5 text-blue-600" />
                            {editingSequence ? `Configure ${editingSequence} Sequence` : 'Create New Sequence'}
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Prefix <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={sequenceForm.prefix}
                                onChange={(e) => setSequenceForm(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded font-mono uppercase"
                                placeholder="INV"
                                maxLength={10}
                                data-testid="sequence-prefix-input"
                              />
                              <p className="text-xs text-gray-500 mt-1">1-10 alphanumeric characters</p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Starting Number <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                value={sequenceForm.starting_number}
                                onChange={(e) => setSequenceForm(prev => ({ ...prev, starting_number: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                                min="1"
                                data-testid="sequence-starting-number"
                              />
                              <p className="text-xs text-gray-500 mt-1">Must be ≥ 1 and greater than last used</p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sequence Length
                              </label>
                              <select
                                value={sequenceForm.sequence_length}
                                onChange={(e) => setSequenceForm(prev => ({ ...prev, sequence_length: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                                data-testid="sequence-length-select"
                              >
                                <option value={3}>3 digits (e.g., 001)</option>
                                <option value={4}>4 digits (e.g., 0001)</option>
                                <option value={5}>5 digits (e.g., 00001)</option>
                                <option value={6}>6 digits (e.g., 000001)</option>
                                <option value={7}>7 digits (e.g., 0000001)</option>
                                <option value={8}>8 digits (e.g., 00000001)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Preview
                              </label>
                              <div className="w-full px-4 py-3 bg-white border-2 border-green-200 rounded font-mono text-lg text-green-700 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5" />
                                {previewNumber}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">This is how your next bill number will look</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-blue-200">
                            <button
                              onClick={async () => {
                                const token = localStorage.getItem('token');
                                try {
                                  await axios.put(`${API}/settings/bill-sequence`, sequenceForm, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  toast.success('Bill sequence settings updated successfully');
                                  fetchBillSequences();
                                  setEditingSequence(null);
                                } catch (error) {
                                  toast.error(error.response?.data?.detail || 'Failed to update sequence');
                                }
                              }}
                              className="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
                              data-testid="save-sequence-btn"
                            >
                              <Save className="w-4 h-4 mr-2 inline" />
                              Save Sequence Settings
                            </button>
                            {editingSequence && (
                              <button
                                onClick={() => {
                                  setEditingSequence(null);
                                  setSequenceForm({
                                    prefix: 'INV',
                                    starting_number: 1,
                                    sequence_length: 6,
                                    allow_prefix_change: true
                                  });
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Info Box */}
                        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-800">
                            <p className="font-medium mb-1">Important Notes:</p>
                            <ul className="list-disc list-inside space-y-1 text-amber-700">
                              <li>Bill numbers are generated <strong>only when bills are settled/saved</strong>, not for drafts</li>
                              <li>Numbers are <strong>never reused</strong>, even if a bill is cancelled</li>
                              <li>Concurrent settlements are handled safely - no duplicate numbers possible</li>
                              <li>Starting number must be greater than the last used number</li>
                            </ul>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">General Configuration</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pharmacy Name
                        </label>
                        <input
                          type="text"
                          value={settings.general.pharmacy_name}
                          onChange={(e) => updateSetting('general', 'pharmacy_name', e.target.value)}
                          className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Currency
                        </label>
                        <select
                          value={settings.general.currency}
                          onChange={(e) => updateSetting('general', 'currency', e.target.value)}
                          className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded"
                        >
                          <option value="INR">INR (₹)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Timezone
                        </label>
                        <select
                          value={settings.general.timezone}
                          onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
                          className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded"
                        >
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                          <option value="America/New_York">America/New_York (EST)</option>
                          <option value="Europe/London">Europe/London (GMT)</option>
                          <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save Button */}
        <div className="border-t px-6 py-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2 inline" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
