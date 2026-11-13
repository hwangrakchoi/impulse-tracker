/**
 * Small components shared by all charts: the tooltip box and the legend.
 * (Shared constants such as axis styling live in chartTheme.js.)
 */

/**
 * The box that appears when hovering/tapping a chart.
 * rows = [{ key, label, value, color? }]
 */
export function TooltipBox({ title, rows, footer }) {
  return (
    <div className="chart-tooltip">
      {title ? <div className="chart-tooltip__title">{title}</div> : null}
      {rows.map((row) => (
        <div key={row.key} className="chart-tooltip__row">
          {row.color ? <span className="chart-tooltip__key" style={{ "--key-color": row.color }} /> : null}
          <span>{row.label}</span>
          <span className="chart-tooltip__value">{row.value}</span>
        </div>
      ))}
      {footer ? <div className="text-xs text-muted">{footer}</div> : null}
    </div>
  );
}

/** A row of colored squares with names. items = [{ key, label, color }] */
export function ChartLegend({ items }) {
  return (
    <ul className="legend" aria-label="Legend">
      {items.map((item) => (
        <li key={item.key} className="legend__item">
          <span className="legend__swatch" style={{ "--swatch": item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
