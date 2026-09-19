/**
 * BackdatedBadge — small "Backdated" pill with a hover tooltip showing the
 * real entry date vs. the picked bill date. Extracted from
 * BillingOperations.js Sep 19, 2026 to keep that file under the 300-line
 * limit (CLAUDE.md Manifesto #4).
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

// tooltip.jsx is untyped plain JS — TooltipContent's inferred prop type
// (via forwardRef) doesn't include `children`/`className` from a .tsx
// caller. Cast once here rather than at every call site.
const TooltipContentAny = TooltipContent as unknown as React.FC<{ children?: React.ReactNode }>;

export interface BackdatedBadgeProps {
  enteredOn: string;
  datedOn: string;
  formatDate: (value: string) => string;
  testId?: string;
}

export default function BackdatedBadge({ enteredOn, datedOn, formatDate, testId }: BackdatedBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold cursor-help"
            data-testid={testId}
          >
            <AlertTriangle className="w-2.5 h-2.5" /> Backdated
          </span>
        </TooltipTrigger>
        <TooltipContentAny>
          Billed on {formatDate(enteredOn)}, dated {formatDate(datedOn)}
        </TooltipContentAny>
      </Tooltip>
    </TooltipProvider>
  );
}
