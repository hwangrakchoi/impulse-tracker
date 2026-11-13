/** Small text helpers shared by several features. */

/** Trims and collapses repeated whitespace: "  At   work " → "At work". */
export function cleanName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Case- and accent-insensitive key for comparing names ("Café" = "cafe"). */
export function nameKey(value) {
  return cleanName(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** 1 → "1 urge", 3 → "3 urges". */
export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** 0.4567 → "46%". Returns "–" when there is nothing to divide by. */
export function formatPercent(fraction) {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return "–";
  return `${Math.round(fraction * 100)}%`;
}

/** Safe division: returns null instead of NaN/Infinity when the total is 0. */
export function ratio(part, total) {
  return total > 0 ? part / total : null;
}
