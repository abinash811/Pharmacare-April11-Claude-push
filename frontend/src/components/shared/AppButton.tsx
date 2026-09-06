import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'chip';
type Size = 'sm' | 'md' | 'lg';
/** Color for variant="chip" only. neutral = gray text, brand on hover.
 *  warning = amber text (e.g. a due date), darker amber on hover.
 *  danger = faint gray text, red on hover (e.g. remove-row "×"). */
type Tone = 'neutral' | 'warning' | 'danger';

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  tone?: Tone;
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  shortcut?: string;
  className?: string;
  children?: ReactNode;
}

const VARIANT_MAP: Record<Variant, string> = {
  primary:   'default',
  secondary: 'secondary',
  outline:   'outline',
  danger:    'destructive',
  ghost:     'ghost',
  // "chip" has no chrome of its own (no bg/border/padding) — built on
  // top of ghost, then CHIP_TONE_CLASSES below strips ghost's own
  // background/padding and applies the inline-text look instead.
  chip:      'ghost',
};

const SIZE_MAP: Record<Size, string> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
};

// variant="chip" — an inline, borderless, paddingless trigger meant to sit
// next to a label (e.g. "DATE" above a clickable "25 Aug 2026"). Not a
// standalone button look; never use it for a primary/secondary action.
const CHIP_BASE = 'h-auto p-0 gap-1 font-medium bg-transparent hover:bg-transparent';
const CHIP_TONE_CLASSES: Record<Tone, string> = {
  neutral: 'text-gray-900 hover:text-brand',
  warning: 'text-amber-700 hover:text-amber-800',
  danger:  'text-gray-300 hover:text-red-500',
};

export default function AppButton({
  variant = 'primary',
  size = 'md',
  tone = 'neutral',
  icon,
  iconOnly = false,
  loading = false,
  disabled = false,
  shortcut,
  className = '',
  children,
  ...rest
}: AppButtonProps) {
  const mappedVariant = VARIANT_MAP[variant] ?? variant;
  const mappedSize    = iconOnly ? 'icon' : (SIZE_MAP[size] ?? 'default');
  const finalClassName = variant === 'chip'
    ? cn(CHIP_BASE, CHIP_TONE_CLASSES[tone], className)
    : className;

  return (
    <Button
      variant={mappedVariant as any}
      size={mappedSize as any}
      disabled={disabled || loading}
      shortcut={!iconOnly ? shortcut : undefined}
      className={finalClassName}
      {...rest}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : icon && <span className="shrink-0">{icon}</span>
      }
      {!iconOnly && children}
    </Button>
  );
}
