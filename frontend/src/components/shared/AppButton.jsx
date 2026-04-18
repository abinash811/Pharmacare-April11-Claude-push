/**
 * AppButton — the ONLY way to render a button in PharmaCare.
 *
 * Using this component makes it impossible to accidentally put dark text on a
 * blue background, use the wrong hover color, or forget disabled styling.
 *
 * Variants:
 *   primary   — Steel Blue bg, white text     (default)
 *   secondary — Gray bg, dark text            (cancel, back)
 *   outline   — White bg, border, dark text   (secondary CTA)
 *   danger    — Red bg, white text            (delete, irreversible)
 *   ghost     — No bg, dark text              (icon buttons, subtle actions)
 *
 * Usage:
 *   <AppButton>Save</AppButton>
 *   <AppButton variant="secondary" onClick={onCancel}>Cancel</AppButton>
 *   <AppButton variant="outline" icon={<Printer />}>Print</AppButton>
 *   <AppButton variant="danger" loading={deleting}>Delete</AppButton>
 *   <AppButton variant="ghost" icon={<Settings />} iconOnly aria-label="Settings" />
 *
 * Props:
 *   variant   {'primary'|'secondary'|'outline'|'danger'|'ghost'}
 *   size      {'sm'|'md'|'lg'}
 *   icon      {ReactNode}   — icon shown before label
 *   iconOnly  {boolean}     — square icon-only button (no label)
 *   loading   {boolean}     — shows spinner, disables interaction
 *   disabled  {boolean}
 *   className {string}      — only for layout overrides (width, margin) — NOT colors
 *   ...rest   — all standard button props (onClick, type, data-testid, etc.)
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANT = {
  primary:   'bg-brand text-white hover:bg-brand-dark',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  outline:   'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  danger:    'bg-red-600 text-white hover:bg-red-700',
  ghost:     'text-gray-600 hover:bg-gray-100',
};

const SIZE = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

export default function AppButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconOnly = false,
  loading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        iconOnly ? 'p-2' : SIZE[size],
        VARIANT[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : icon && <span className="shrink-0">{icon}</span>
      }
      {!iconOnly && children}
    </button>
  );
}
