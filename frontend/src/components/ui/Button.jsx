import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

// The one Button every future page should use. Variants map to the
// semantic color system (§5 of the design system), not brand decoration —
// "danger" is always red regardless of theme, "primary" is always the
// soft-blue accent. Replaces the old `.btn-primary`/`.btn-ghost` pill
// classes (999px radius, no real size scale, no loading state).
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, icon, children, className = '', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="ui-btn-spinner" size={size === 'sm' ? 14 : 16} /> : icon}
      {children}
    </button>
  )
})

export default Button
