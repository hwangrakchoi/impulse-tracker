/**
 * ChartCard – the frame around every chart: title, explanation, optional
 * controls, and a "Table" switch.
 *
 * The table view shows the same numbers as the chart in plain rows. It is
 * there for screen-reader users, for anyone who finds a chart hard to read,
 * and so that no value is ever reachable only through a hover tooltip.
 */
import { useState } from "react";
import { ChartColumn, Table } from "lucide-react";

/**
 * table = {
 *   caption: "what the table shows",
 *   columns: [{ key, label, isNumber? }],
 *   rows:    [{ key, ...values }]
 * }
 */
export function DataTable({ caption, columns, rows }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.isNumber ? "is-number" : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={column.key} scope="row">
                    {row[column.key]}
                  </th>
                ) : (
                  <td key={column.key} className={column.isNumber ? "is-number" : undefined}>
                    {row[column.key]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChartCard({ title, subtitle, note, controls, table, isEmpty = false, emptyMessage, children }) {
  const [isTableShown, setIsTableShown] = useState(false);
  const canShowTable = Boolean(table) && !isEmpty;

  return (
    <section className="card chart-card" aria-label={title}>
      <div className="chart-card__header">
        <div className="stack stack--xs">
          <h2>{title}</h2>
          {subtitle ? <p className="chart-card__subtitle">{subtitle}</p> : null}
        </div>
        {canShowTable ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setIsTableShown((current) => !current)}
            aria-pressed={isTableShown}
            aria-label={isTableShown ? `Show ${title} as a chart` : `Show ${title} as a table`}
          >
            {isTableShown ? <ChartColumn size={16} aria-hidden="true" /> : <Table size={16} aria-hidden="true" />}
            {isTableShown ? "Chart" : "Table"}
          </button>
        ) : null}
      </div>

      {controls ? <div className="chart-card__controls">{controls}</div> : null}

      {isEmpty ? (
        <p className="text-secondary">{emptyMessage}</p>
      ) : isTableShown ? (
        <DataTable {...table} />
      ) : (
        children
      )}

      {note ? <p className="chart-card__note">{note}</p> : null}
    </section>
  );
}
