// @ts-nocheck
/**
 * ProfileCategoryNav — left-side category list for PharmacyProfileTab.
 * Collapsible: the toggle icon shrinks it to icon-only (tooltip on hover
 * shows the label), click again to expand. Sep 21, 2026, direct request —
 * gives the user the choice between the full nav and more room for fields.
 */
import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AppButton } from '@/components/shared';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// tooltip.jsx is untyped plain JS — same cast BackdatedBadge.tsx uses.
const TooltipContentAny = TooltipContent as unknown as React.FC<{ children?: React.ReactNode; side?: string }>;

interface Category {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  categories: Category[];
  activeCategory: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function ProfileCategoryNav({ categories, activeCategory, onSelect, collapsed, onToggleCollapsed }: Props) {
  return (
    <nav className="space-y-1" data-testid="profile-category-nav">
      <div className={cn('flex items-center mb-1', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && <span className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2">Categories</span>}
        <AppButton
          type="button"
          variant="ghost"
          iconOnly
          icon={collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand categories' : 'Collapse categories'}
          data-testid="profile-nav-collapse-toggle"
        />
      </div>

      <TooltipProvider>
        {categories.map(({ key, label, icon: Icon }) => {
          const active = activeCategory === key;
          const item = (
            <AppButton
              type="button"
              variant="ghost"
              onClick={() => onSelect(key)}
              className={cn(
                'w-full font-normal',
                collapsed ? 'justify-center px-0' : 'justify-start gap-2',
                active ? 'bg-brand-tint text-brand font-medium' : 'text-gray-600',
              )}
              data-testid={`profile-category-${key}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && label}
            </AppButton>
          );
          if (!collapsed) return <div key={key}>{item}</div>;
          return (
            <Tooltip key={key}>
              {/* asChild needs a real DOM node to attach a ref to — AppButton
                  isn't forwardRef, so the trigger wraps it in a div rather
                  than targeting the button directly (same reasoning as
                  BackdatedBadge.tsx's span wrapper). */}
              <TooltipTrigger asChild>
                <div className="w-full">{item}</div>
              </TooltipTrigger>
              <TooltipContentAny side="right">{label}</TooltipContentAny>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </nav>
  );
}
