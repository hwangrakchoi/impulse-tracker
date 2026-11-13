/**
 * Shared chart settings and helpers (plain values, no components), so every
 * chart looks like part of one family.
 *
 * Colors are CSS variables (e.g. "var(--chart-grid)"), so charts switch
 * between light and dark mode together with the rest of the app.
 */

/** Styling for axis numbers/labels – quiet, so the data stands out. */
export const AXIS_TICK = { fill: "var(--text-muted)", fontSize: 12 };
export const GRID_COLOR = "var(--chart-grid)";
export const AXIS_COLOR = "var(--chart-axis)";
export const SERIES_COLOR = "var(--chart-series)";

/** Charts do not animate: values appear immediately and motion-sensitive users are not affected. */
export const NO_ANIMATION = { isAnimationActive: false };

/** Shortens long names for axis labels: "Compulsive social media" → "Compulsive soc…" */
export function truncateLabel(text, maxLength = 16) {
  const value = String(text ?? "");
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

/** Rough pixel width needed for the longest axis label (≈7px per character). */
export function estimateAxisWidth(labels, { min = 56, max = 132 } = {}) {
  const longest = labels.reduce((length, label) => Math.max(length, String(label).length), 0);
  return Math.min(max, Math.max(min, Math.round(longest * 7 + 12)));
}
