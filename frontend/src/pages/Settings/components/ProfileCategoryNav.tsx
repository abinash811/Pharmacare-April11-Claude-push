// @ts-nocheck
/**
 * ProfileCategoryNav — left-side category list for PharmacyProfileTab.
 * Plain vertical list; clicking an item scrolls the right column to that
 * section. (The collapse-to-icons idea from the same conversation was for
 * the app's main sidebar, Layout.js — not this nav.)
 */
import React from 'react';
import { AppButton } from '@/components/shared';
import { cn } from '@/lib/utils';

interface Category {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  categories: Category[];
  activeCategory: string;
  onSelect: (key: string) => void;
}

export default function ProfileCategoryNav({ categories, activeCategory, onSelect }: Props) {
  return (
    <nav className="space-y-1" data-testid="profile-category-nav">
      {categories.map(({ key, label, icon: Icon }) => {
        const active = activeCategory === key;
        return (
          <AppButton
            key={key}
            type="button"
            variant="ghost"
            onClick={() => onSelect(key)}
            className={cn(
              'w-full justify-start gap-2 font-normal',
              active ? 'bg-brand-tint text-brand font-medium' : 'text-gray-600',
            )}
            data-testid={`profile-category-${key}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </AppButton>
        );
      })}
    </nav>
  );
}
