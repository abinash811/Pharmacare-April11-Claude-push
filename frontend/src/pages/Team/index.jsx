import React, { useState, useContext } from 'react';
import { AuthContext } from '@/App';
import { AlertCircle } from 'lucide-react';
import { PageHeader, PageTabs } from '@/components/shared';
import MembersTab from './components/MembersTab';
import RolesTab from './components/RolesTab';

const TEAM_TABS = [
  { key: 'members', label: 'Members' },
  { key: 'roles',   label: 'Roles'   },
];

function AccessDenied() {
  return (
    <div className="flex-1 flex items-center justify-center py-32">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="text-base font-semibold text-gray-900 mb-1">Access Denied</h2>
        <p className="text-sm text-gray-500">You do not have permission to access this page.</p>
      </div>
    </div>
  );
}

export default function Team() {
  const { user: currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('members');

  if (currentUser?.role !== 'admin') return <AccessDenied />;

  return (
    <div className="px-8 py-6 min-h-screen bg-[#F8FAFB]">
      <PageHeader title="Team" />
      <PageTabs tabs={TEAM_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className={activeTab !== 'members' ? 'hidden' : ''}>
        <MembersTab currentUser={currentUser} />
      </div>
      <div className={activeTab !== 'roles' ? 'hidden' : ''}>
        <RolesTab />
      </div>
    </div>
  );
}
