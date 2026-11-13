/** Small presentational components shared across pages. */
import { createElement } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { getHabitIconComponent } from "../../data/habitIcons.js";

/** A habit's icon on a tile tinted with the habit's accent color. */
export function HabitIcon({ habit, size = "md" }) {
  const pixelSize = size === "lg" ? 28 : size === "sm" ? 18 : 22;
  return (
    <span
      className={`habit-icon ${size === "md" ? "" : `habit-icon--${size}`}`}
      // A CSS variable set inline: the stylesheet turns it into the tile colors.
      style={{ "--habit-color": habit?.accentColor ?? "#6b7280" }}
      aria-hidden="true"
    >
      {/* createElement(component, props) is what <Component /> compiles to. */}
      {createElement(getHabitIconComponent(habit?.icon), { size: pixelSize })}
    </span>
  );
}

/** Title block at the top of every page. */
export function PageHeader({ title, subtitle, actions, backTo, backLabel = "Back" }) {
  return (
    <header className="stack stack--xs">
      {backTo ? (
        <Link to={backTo} className="page-header__back">
          <ChevronLeft size={20} aria-hidden="true" />
          {backLabel}
        </Link>
      ) : null}
      <div className="page-header">
        <div className="page-header__text">
          <h1>{title}</h1>
          {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="row">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Friendly placeholder for "nothing here yet", with an optional next step. */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon size={28} />
        </span>
      ) : null}
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** One headline number with a label – used on the dashboard. */
export function StatTile({ label, value, note, isText = false }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <span className={`stat-tile__value ${isText ? "stat-tile__value--text" : ""}`}>{value}</span>
      {note ? <span className="stat-tile__note">{note}</span> : null}
    </div>
  );
}

/**
 * A list of rows, each with a name, a proportional bar and a figure.
 * rows = [{ key, name, value: "5 urges", detail?: "smaller second line", fraction: 0..1, color? }]
 */
export function MeterList({ rows, label }) {
  return (
    <ul className="meter-list" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="meter-row">
          <span className="meter-row__name">{row.name}</span>
          <span className="meter-row__value">{row.value}</span>
          {row.detail ? <span className="meter-row__detail">{row.detail}</span> : null}
          <span className="meter-row__track" aria-hidden="true">
            <span
              className="meter-row__fill"
              style={{ width: `${Math.round((row.fraction ?? 0) * 100)}%`, "--meter-color": row.color }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
