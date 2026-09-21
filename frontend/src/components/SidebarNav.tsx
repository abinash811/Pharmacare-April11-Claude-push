// @ts-nocheck
/**
 * SidebarNav — nav groups + items for Layout.js's main sidebar.
 * Collapsed: icons only, group headings hidden, tooltip on hover shows
 * the item name. Sep 21, 2026, direct request — same collapse-to-icons
 * idea originally explored for Settings, built here on the real target
 * (the app's main sidebar) instead.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

// tooltip.jsx is untyped plain JS — same cast BackdatedBadge.tsx uses.
const TooltipContentAny = TooltipContent as unknown as React.FC<{ children?: React.ReactNode; side?: string }>;

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

interface Props {
  groups: NavGroup[];
  collapsed: boolean;
}

export default function SidebarNav({ groups, collapsed }: Props) {
  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2">
      <TooltipProvider>
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400 px-3 mt-4 mb-1 first:mt-2">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const link = (
                <NavLink
                  to={item.path}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 h-9 [@media(pointer:coarse)]:h-11 rounded-lg transition-colors text-[13px] font-medium mb-0.5 ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${
                      isActive
                        ? 'bg-blue-600/20 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      {!collapsed && <span>{item.name}</span>}
                    </>
                  )}
                </NavLink>
              );
              if (!collapsed) return <div key={item.path}>{link}</div>;
              return (
                <Tooltip key={item.path}>
                  {/* Wrapped in a div rather than targeting NavLink directly
                      — same reasoning as BackdatedBadge.tsx's span wrapper,
                      a plain DOM node is a safer asChild ref target. */}
                  <TooltipTrigger asChild>
                    <div>{link}</div>
                  </TooltipTrigger>
                  <TooltipContentAny side="right">{item.name}</TooltipContentAny>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </TooltipProvider>
    </nav>
  );
}
