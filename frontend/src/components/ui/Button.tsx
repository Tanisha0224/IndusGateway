import { ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'confirm' | 'destructive'
type Size = 'md' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-saffron text-white hover:bg-saffron-deep focus-visible:ring-2 focus-visible:ring-saffron-deep disabled:bg-saffron/40',
  secondary: 'bg-navy text-white hover:bg-navy-ink disabled:bg-navy/40',
  ghost: 'bg-transparent text-navy border border-navy/30 hover:bg-navy/5 disabled:text-navy/30 disabled:border-navy/10',
  confirm: 'bg-emerald text-white hover:bg-emerald-deep disabled:bg-emerald/40',
  destructive: 'bg-critical text-white hover:bg-red-700 disabled:bg-critical/40',
}

const sizeClasses: Record<Size, string> = {
  md: 'h-11 px-5 text-body',
  sm: 'h-9 px-3.5 text-table',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold font-body transition-colors duration-150 whitespace-nowrap select-none',
        'disabled:cursor-not-allowed',
        variantClasses[variant], sizeClasses[size], className
      )}
      {...rest}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  )
})
