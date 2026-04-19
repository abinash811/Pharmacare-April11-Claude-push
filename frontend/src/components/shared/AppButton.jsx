/**
 * AppButton — the ONLY way to render a button in PharmaCare.
 *
 * Thin compatibility wrapper over ui/button.jsx (Shadcn + PharmaCare tokens).
 * All new code should prefer importing Button from @/components/ui/button directly.
 * AppButton stays for backward-compat — same props API, same visual output.
 *
 * Variants:
 *   primary   — Steel Blue bg, white text     (default)
 *   secondary — Gray bg, dark text            (cancel, back)
 *   outline   — White bg, border, dark text   (secondary CTA)
 *   danger    — Red bg, white text            (delete, irreversible)
 *   ghost     — No bg, dark text              (icon buttons, subtle actions)
 *
 * Extra props:
 *   icon      {ReactNode}   — icon shown before label
 *   iconOnly  {boolean}     — square icon-only button (no label)
 *   loading   {boolean}     — shows spinner, disables interaction
 *   shortcut  {string}      — keyboard shortcut badge (e.g. "N", "⌘K")
 *
 * Usage:
 *   <AppButton>Save</AppButton>
 *   <AppButton variant="secondary" onClick={onCancel}>Cancel</AppButton>
 *   <AppButton variant="outline" icon={<Printer />}>Print</AppButton>
 *   <AppButton variant="danger" loading={deleting}>Delete</AppButton>
 *   <AppButton variant="ghost" icon={<Settings />} iconOnly aria-label="Settings" />
 *   <AppButton shortcut="N">New Bill</AppButton>
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Map AppButton variant names → ui/button variant names
const VARIANT_MAP = {
  primary:   'default',
  secondary: 'secondary',
  outline:   'outline',
  danger:    'destructive',
  ghost:     'ghost',
};

// Map AppButton size names → ui/button size names
const SIZE_MAP = {
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
}) {
  const mappedVariant = VARIANT_MAP[variant] ?? variant;
  const mappedSize    = iconOnly ? 'icon' : (SIZE_MAP[size] ?? 'default');

  return (
    <Button
      variant={mappedVariant}
      size={mappedSize}
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
