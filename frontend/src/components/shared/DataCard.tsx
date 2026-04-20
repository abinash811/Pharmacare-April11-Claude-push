import React, { ReactNode } from 'react';
import { Card, CardContent } from '../ui/card';

export interface DataCardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function DataCard({ children, className = '', noPadding = true }: DataCardProps) {
  return (
    <Card className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`} data-testid="data-card">
      <CardContent className={noPadding ? 'p-0' : 'p-4'}>
        {children}
      </CardContent>
    </Card>
  );
}
