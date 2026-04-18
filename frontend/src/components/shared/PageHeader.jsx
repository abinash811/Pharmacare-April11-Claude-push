import React from 'react';

/**
 * PageHeader - Full-width white header bar with bottom border/shadow.
 * Breaks out of the standard px-8 py-6 page padding using negative margins
 * so it spans edge-to-edge inside the main content area.
 *
 * @param {string}      props.title     - Main page title
 * @param {string}      props.subtitle  - Muted count/description line
 * @param {ReactNode}   props.actions   - CTA buttons (right side)
 * @param {string}      props.className - Optional extra classes
 */
export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div
      className={`-mx-8 -mt-6 mb-6 px-8 py-4 bg-white border-b border-gray-200 shadow-sm ${className}`}
      data-testid="page-header"
    >
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
