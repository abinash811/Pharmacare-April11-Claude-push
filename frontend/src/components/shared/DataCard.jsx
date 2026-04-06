import React from 'react';
import { Card, CardContent } from '../ui/card';

/**
 * DataCard - White card wrapper for tables and data content
 * Matches the Customers page design reference
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.className - Optional additional classes
 * @param {boolean} props.noPadding - Remove default padding (for tables)
 */
export function DataCard({ children, className = '', noPadding = true }) {
  return (
    <Card className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`} data-testid="data-card">
      <CardContent className={noPadding ? 'p-0' : 'p-4'}>
        {children}
      </CardContent>
    </Card>
  );
}
