// A semantic badge — tone determines color by MEANING (success/warning/
// danger/info/neutral/accent), never a raw hex or brand color, so status
// meaning stays consistent everywhere it's used (transfer status, account
// active/inactive, verification state, etc).
export default function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`ui-badge ui-badge-${tone} ${className}`}>{children}</span>
}
