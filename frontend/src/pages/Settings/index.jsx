/**
 * Settings — orchestrator
 * Route: /settings
 */
import React, { useContext, useEffect } from 'react';
import { Save } from 'lucide-react';
import { AuthContext } from '@/App';
import { InlineLoader, PageHeader, PageTabs, AppButton } from '@/components/shared';

import { useSettings }     from './hooks/useSettings';
import InventoryTab        from './components/InventoryTab';
import BillingTab          from './components/BillingTab';
import ReturnsTab          from './components/ReturnsTab';
import GeneralTab          from './components/GeneralTab';
import BillSequenceTab     from './components/BillSequenceTab';

const SETTINGS_TABS = [
  { key: 'inventory',     label: 'Inventory'     },
  { key: 'billing',       label: 'Billing'       },
  { key: 'bill_sequence', label: 'Bill Sequence' },
  { key: 'returns',       label: 'Returns'       },
  { key: 'general',       label: 'General'       },
];

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
          <h1 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm">Only administrators can access settings.</p>
        </div>
      </div>
    );
  }

  const makeUpdater = (section) => (key, value) => updateSetting(section, key, value);

  return (
    <div className="min-h-screen bg-[#F8FAFB] px-8 py-6">
      <PageHeader
        title="Settings"
      />
      <PageTabs
        tabs={SETTINGS_TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Content area */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12"><InlineLoader text="Loading settings…" /></div>
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

        {/* Save button — not shown on bill_sequence tab (it has its own per-row save) */}
        {activeTab !== 'bill_sequence' && (
          <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
            <AppButton
              onClick={() => saveSettings(settings)}
              loading={saving}
              icon={<Save className="w-4 h-4" />}
              data-testid="save-settings-btn"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </AppButton>
          </div>
        )}
      </div>
    </div>
  );
}
