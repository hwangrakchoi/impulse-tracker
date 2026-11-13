/**
 * Date helpers.
 *
 * Rule of thumb used across the app:
 *   - STORE timestamps as ISO-8601 strings in UTC, e.g. "2026-11-14T01:45:00.000Z".
 *     They sort correctly as plain text and mean the same instant everywhere.
 *   - DISPLAY them in the device's local time zone using the helpers below.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The current moment as a UTC ISO string. */
export function nowIso() {
  return new Date().toISOString();
}

/** Accepts a Date or an ISO string and returns a Date. */
export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function isValidIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

const pad = (number) => String(number).padStart(2, "0");

/** "2026-11-13" for the LOCAL calendar day of a timestamp. */
export function toLocalDateKey(value) {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Value for <input type="datetime-local">: "2026-11-13T17:45" in local time. */
export function toLocalInputValue(value) {
  const date = toDate(value);
  return `${toLocalDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converts a datetime-local input value back to a UTC ISO string (or null). */
export function fromLocalInputValue(inputValue) {
  if (!inputValue) return null;
  // `new Date("2026-11-13T17:45")` (no "Z") is interpreted as local time.
  const date = new Date(inputValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Parses "2026-11-13" (from <input type="date">) as local midnight. */
export function parseLocalDate(dateKey) {
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfLocalDay(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(value, days) {
  const date = toDate(value);
  // Using the Date constructor (not + 24h) stays correct across daylight-saving changes.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());
}

/** First day of the week for the device's locale: 0 = Sunday … 6 = Saturday. */
export function getFirstDayOfWeek() {
  try {
    const locale = new Intl.Locale(navigator.language);
    const info = typeof locale.getWeekInfo === "function" ? locale.getWeekInfo() : locale.weekInfo;
    if (info?.firstDay) return info.firstDay % 7; // Intl uses 7 for Sunday
  } catch {
    /* fall through to the default */
  }
  return 0;
}

export function startOfLocalWeek(value, firstDayOfWeek = getFirstDayOfWeek()) {
  const dayStart = startOfLocalDay(value);
  const daysSinceWeekStart = (dayStart.getDay() - firstDayOfWeek + 7) % 7;
  return addDays(dayStart, -daysSinceWeekStart);
}

/** Whole calendar days between two dates (ignores the time of day). */
export function differenceInCalendarDays(later, earlier) {
  const a = startOfLocalDay(later);
  const b = startOfLocalDay(earlier);
  // Compare as UTC dates so daylight-saving hours cannot skew the result.
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / MS_PER_DAY);
}

// Intl.DateTimeFormat objects are slow to create, so make each one once.
const dateFormat = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const weekdayDateFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** "November 13, 2026" */
export function formatDate(value) {
  return dateFormat.format(toDate(value));
}

/** "Nov 13" */
export function formatShortDate(value) {
  return shortDateFormat.format(toDate(value));
}

/** "5:45 PM" */
export function formatTime(value) {
  return timeFormat.format(toDate(value));
}

/** "November 13, 2026 — 5:45 PM" */
export function formatDateTime(value) {
  return `${formatDate(value)} — ${formatTime(value)}`;
}

/** "Today", "Yesterday" or "Friday, November 13, 2026" for timeline headings. */
export function formatDayHeading(value, now = new Date()) {
  const daysAgo = differenceInCalendarDays(now, value);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return weekdayDateFormat.format(toDate(value));
}

/** "just now", "12 min ago", "3 h ago" or a short date – for recent items. */
export function formatRelativeTime(value, now = new Date()) {
  const minutes = Math.round((now.getTime() - toDate(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = differenceInCalendarDays(now, value);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatShortDate(value);
}

/** "5 AM", "12 PM" … for chart axes. `hour` is 0–24. */
export function formatHourLabel(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const twelveHour = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${twelveHour} ${suffix}`;
}

/**
 * Date-range presets used by the dashboard and history filters.
 * Returns { from, to } as Dates; `null` means "no limit on that side".
 */
export const DATE_RANGE_PRESETS = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "all", label: "All time", days: null },
];

export function getPresetRange(presetValue, now = new Date()) {
  const preset = DATE_RANGE_PRESETS.find((option) => option.value === presetValue);
  if (!preset || preset.days === null) return { from: null, to: null };
  // "7 days" = today plus the six days before it.
  return { from: startOfLocalDay(addDays(now, -(preset.days - 1))), to: endOfLocalDay(now) };
}
