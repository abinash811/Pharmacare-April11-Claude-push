import React, { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, breadcrumb, className = '' }: PageHeaderProps) {
  return (
    <div
      className={`-mx-8 -mt-6 mb-6 px-8 py-4 bg-white border-b border-gray-200 shadow-sm ${className}`}
      data-testid="page-header"
    >
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
