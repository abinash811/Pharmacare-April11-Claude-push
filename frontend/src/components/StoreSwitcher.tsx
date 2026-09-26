/**
 * StoreSwitcher — sidebar footer, lets a person move between every store
 * they have access to (docs/26_MULTI_CHAIN_SCOPE.md Step 2).
 *
 * Always shown, even for a plain single-store account — a direct
 * instruction, not conditionally hidden once a chain exists. Switching
 * updates the account's active store server-side, then does a full page
 * reload: dozens of pages/hooks already cache pharmacy-scoped data, and a
 * hard reload is the simplest way to guarantee none of it survives stale
 * into the new store.
 */
import React, { useEffect, useState } from 'react';
import { Building2, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { AppButton } from '@/components/shared';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface Store {
  pharmacy_id: string;
  pharmacy_name: string;
  role_name: string;
  is_active: boolean;
}

export default function StoreSwitcher({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  // Starts true (not set inside the effect below) so the trigger's own
  // "Loading..." label is correct on the very first render, before the
  // fetch below has a chance to run — react-hooks/set-state-in-effect.
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Fetched once on mount, not reactively on `open` — the trigger itself
  // needs the active store's name before the popover is ever opened.
  useEffect(() => {
    api.get(apiUrl.myStores())
      .then(res => setStores(res.data || []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  const active = stores.find(s => s.is_active);

  const handleSwitch = async (store: Store) => {
    if (store.is_active || switching) return;
    setSwitching(true);
    try {
      await api.post(apiUrl.switchStore(), { pharmacy_id: store.pharmacy_id });
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || 'Failed to switch store');
      setSwitching(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <AppButton
          variant="ghost"
          data-testid="store-switcher-trigger"
          aria-label="Switch store"
          className={`w-full h-8 rounded-lg text-[13px] font-medium text-gray-300 hover:text-white hover:bg-white/5 mb-1 ${collapsed ? 'justify-center px-0' : 'justify-start gap-2 px-3'}`}
          icon={<Building2 className="w-4 h-4 flex-shrink-0" />}
        >
          {!collapsed && (
            <span className="truncate">{active?.pharmacy_name || 'Loading...'}</span>
          )}
        </AppButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1 overflow-hidden"
        align="start"
        side="top"
        sideOffset={4}
      >
        {loading && <div className="px-3 py-2 text-xs text-gray-400">Loading stores...</div>}
        {!loading && stores.map(store => (
          <AppButton
            key={store.pharmacy_id}
            variant="ghost"
            onClick={() => handleSwitch(store)}
            disabled={switching}
            className="w-full justify-start px-2.5 py-2 text-sm rounded-md"
            data-testid={`store-switcher-option-${store.pharmacy_id}`}
          >
            <span className="w-4 h-4 flex-shrink-0">
              {store.is_active && <Check className="w-4 h-4 text-brand" />}
            </span>
            <div className="min-w-0 text-left">
              <div className="truncate text-gray-900">{store.pharmacy_name}</div>
              <div className="truncate text-xs text-gray-500 capitalize">{store.role_name}</div>
            </div>
          </AppButton>
        ))}
      </PopoverContent>
    </Popover>
  );
}
