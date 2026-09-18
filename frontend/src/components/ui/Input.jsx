import { forwardRef } from 'react'

// A labeled input with a real error state, replacing the bare <input>
// elements scattered through the app with no consistent focus ring or
// validation display.
const Input = forwardRef(function Input({ label, error, hint, id, className = '', ...rest }, ref) {
  const inputId = id || rest.name
  return (
    <label className={`ui-field ${className}`} htmlFor={inputId}>
      {label && <span className="ui-field-label">{label}</span>}
      <input ref={ref} id={inputId} className={`ui-input ${error ? 'ui-input-error' : ''}`} {...rest} />
      {error ? <span className="ui-field-error">{error}</span> : hint ? <span className="ui-field-hint">{hint}</span> : null}
    </label>
  )
})

export default Input
