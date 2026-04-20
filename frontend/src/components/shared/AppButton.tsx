import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
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
};

const SIZE_MAP: Record<Size, string> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
};

export default function AppButton({
  variant = 'primary',
  size = 'md',
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

  return (
    <Button
      variant={mappedVariant as any}
      size={mappedSize as any}
      disabled={disabled || loading}
      shortcut={!iconOnly ? shortcut : undefined}
      className={className}
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
