/**
 * MetricCard — key sales metric with trend badge, accent bar, and optional sparkline.
 *
 * Props:
 *   title      {string}
 *   value      {string}
 *   change     {number|undefined}   percentage change vs period (e.g. 12.4 = +12.4%)
 *   delta      {string|undefined}   absolute delta label (e.g. "+₹1,234")
 *   icon       {ReactNode}
 *   color      {'green'|'blue'|'purple'|'indigo'}
 *   subtitle   {string}             period label (e.g. "vs yesterday")
 *   sparkline  {number[]|undefined} 7-point data for mini SVG chart
 *   testId     {string}
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SPARK_STROKE } from '@/utils/chartColors';

const ACCENT = {
  green:  'bg-green-500',
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  indigo: 'bg-indigo-500',
};

const ICON_BG = {
  green:  'bg-green-50 text-green-600',
  blue:   'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};


function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;

  const W = 64, H = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="opacity-80">
      <polyline
        points={points}
        stroke={SPARK_STROKE[color] || SPARK_STROKE.indigo}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function MetricCard({ title, value, change, delta, icon, color = 'blue', subtitle, sparkline, testId }) {
  const isPositive = change > 0;
  const isNeutral  = change === 0 || change === undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow" data-testid={testId}>
      {/* Accent bar */}
      <div className={`h-1 w-full ${ACCENT[color] || ACCENT.blue}`} />

      <div className="p-4">
        {/* Top row: icon + change badge */}
        <div className="flex items-start justify-between mb-3">
          <span className={`p-2 rounded-lg ${ICON_BG[color]}`}>
            {icon}
          </span>

          {change !== undefined && (
            <div className="flex flex-col items-end gap-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isNeutral  ? 'bg-gray-100 text-gray-500' :
                isPositive ? 'bg-green-50 text-green-700' :
                             'bg-red-50 text-red-600'
              }`}>
                {isNeutral
                  ? <Minus className="w-3 h-3" />
                  : isPositive
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />
                }
                {isPositive ? '+' : ''}{change}%
              </span>
              {delta && (
                <span className={`text-[10px] font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                  {delta}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Value */}
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{title}</p>

        {/* Bottom row: subtitle + sparkline */}
        <div className="flex items-end justify-between mt-3">
          <span className="text-[10px] text-gray-400 uppercase font-medium tracking-wide">{subtitle}</span>
          <Sparkline data={sparkline} color={color} />
        </div>
      </div>
    </div>
  );
}
