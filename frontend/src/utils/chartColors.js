/**
 * Chart color palette — single source of truth for all Recharts colors.
 *
 * Recharts renders into SVG and does not support Tailwind classes on stroke/fill
 * attributes, so colors must be hex strings. Define them here; import everywhere.
 *
 * CHART_PALETTE  — ordered series colors for PieChart / BarChart / LineChart
 * SPARK_STROKE   — sparkline stroke by MetricCard color variant
 * BRAND_BLUE     — brand primary, used for single-series area/line charts
 */

export const CHART_PALETTE = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
];

export const SPARK_STROKE = {
  green:  '#22c55e', // green-500
  blue:   '#3b82f6', // blue-500
  purple: '#a855f7', // purple-500
  indigo: '#6366f1', // indigo-500
};

export const BRAND_BLUE = '#4682B4';

// Recharts axis / grid line colors — Tailwind gray-200 and gray-400
export const CHART_GRID_COLOR = '#e5e7eb';  // gray-200
export const CHART_AXIS_COLOR = '#9ca3af';  // gray-400
