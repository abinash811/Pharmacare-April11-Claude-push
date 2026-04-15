/**
 * Settings — orchestrator
 * Route: /settings
 */
import React, { useContext, useEffect } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { AuthContext } from '@/App';
import { InlineLoader } from '@/components/shared';

import { useSettings }     from './hooks/useSettings';
import SettingsTabs        from './components/SettingsTabs';
import InventoryTab        from './components/InventoryTab';
import BillingTab          from './components/BillingTab';
import ReturnsTab          from './components/ReturnsTab';
import GeneralTab          from './components/GeneralTab';
import BillSequenceTab     from './components/BillSequenceTab';

export default function Settings() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = React.useState('inventory');

  const {
    settings, loading, saving,
    billSequences, sequenceLoading,
    fetchSettings, saveSettings,
    fetchBillSequences, saveBillSequence,
    updateSetting,
  } = useSettings();

  useEffect(() => { fetchSettings(); }, []); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'bill_sequence') fetchBillSequences();
  }, [activeTab]); // eslint-disable-line

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

  const makeUpdater = (section) => (key, value) => updateSetting(section, key, value);

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

      <div className="bg-white rounded-lg shadow mb-6">
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12"><InlineLoader text="Loading settings..." /></div>
          ) : (
            <>
              {activeTab === 'inventory'     && <InventoryTab     inventory={settings.inventory}  onUpdate={makeUpdater('inventory')} />}
              {activeTab === 'billing'       && <BillingTab       billing={settings.billing}      onUpdate={makeUpdater('billing')} />}
              {activeTab === 'returns'       && <ReturnsTab       returns={settings.returns}      onUpdate={makeUpdater('returns')} />}
              {activeTab === 'general'       && <GeneralTab       general={settings.general}      onUpdate={makeUpdater('general')} />}
              {activeTab === 'bill_sequence' && (
                <BillSequenceTab
                  billSequences={billSequences}
                  sequenceLoading={sequenceLoading}
                  onSave={saveBillSequence}
                  onRefresh={fetchBillSequences}
                />
              )}
            </>
          )}
        </div>

        {/* Save Button (not shown on bill_sequence tab — it has its own save) */}
        {activeTab !== 'bill_sequence' && (
          <div className="border-t px-6 py-4 flex justify-end">
            <button
              onClick={() => saveSettings(settings)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-blue-300"
              data-testid="save-settings-btn"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
