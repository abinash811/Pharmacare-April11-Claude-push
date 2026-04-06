import React from 'react';

/**
 * PageHeader - Shared component for page headers
 * Matches the Customers page design reference
 * 
 * @param {Object} props
 * @param {string} props.title - Main page title
 * @param {string} props.subtitle - Muted subtitle text
 * @param {React.ReactNode} props.actions - Optional action buttons (right side)
 * @param {string} props.className - Optional additional classes
 */
export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`mb-6 ${className}`} data-testid="page-header">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
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
