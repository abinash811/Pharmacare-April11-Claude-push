/**
 * MetricCard — key sales metric with trend indicator.
 * Props:
 *   title    {string}
 *   value    {string}
 *   change   {number|undefined}  percentage change
 *   icon     {ReactNode}
 *   color    {'green'|'blue'|'purple'|'indigo'}
 *   subtitle {string}
 *   testId   {string}
 */
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const COLOR_CLASSES = {
  green:  'bg-green-50 text-green-600',
  blue:   'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  indigo: 'bg-blue-50 text-blue-600',
};

export default function MetricCard({ title, value, change, icon, color, subtitle, testId }) {
  const isPositive = change >= 0;

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`p-2 rounded-lg ${COLOR_CLASSES[color]}`}>
            {icon}
          </span>
          {change !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{change}%
            </span>
          )}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{title} <span className="text-gray-400">• {subtitle}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}
