import Skeleton from './Skeleton.jsx'

// Generic table primitives for future phases — sticky header, a loading
// state that renders skeleton rows matching the real column count (so the
// layout doesn't jump when data arrives), and a dedicated empty slot
// instead of a bare "No data." string.
export function Table({ children, className = '' }) {
  return (
    <div className="ui-table-scroll">
      <table className={`ui-table ${className}`}>{children}</table>
    </div>
  )
}

export function TableHead({ columns }) {
  return (
    <thead className="ui-table-head">
      <tr>
        {columns.map((col) => (
          <th key={col.key} style={{ textAlign: col.align || 'left' }}>{col.label}</th>
        ))}
      </tr>
    </thead>
  )
}

export function TableSkeletonRows({ columns, rows = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {columns.map((col) => (
            <td key={col.key}><Skeleton height={14} width={col.skeletonWidth || '70%'} /></td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

export function TableEmpty({ columns, icon, title, description, action }) {
  return (
    <tbody>
      <tr>
        <td colSpan={columns.length}>
          <div className="ui-empty-state">
            {icon && <div className="ui-empty-icon">{icon}</div>}
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {action}
          </div>
        </td>
      </tr>
    </tbody>
  )
}
