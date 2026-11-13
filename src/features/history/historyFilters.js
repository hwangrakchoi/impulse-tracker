/**
 * The History page keeps its filter form as simple strings (that is what
 * <select> and <input> produce). These helpers convert that form state into
 * the shape the analytics `filterEntries` function expects, and describe the
 * active filters as removable chips.
 */
import { OUTCOME_FILTER_NONE, getOutcomeLabel } from "../../data/defaults.js";
import { getCategory, getEmotionDisplayName } from "../../data/emotionTaxonomy.js";
import { endOfLocalDay, formatShortDate, parseLocalDate } from "../../utils/dates.js";

export const EMPTY_FILTERS = Object.freeze({
  habitId: "",
  fromDate: "", // "2026-11-01"
  toDate: "",
  categoryId: "",
  emotionId: "",
  intensityMin: "",
  intensityMax: "",
  outcome: "",
});

/** Form state → arguments for `filterEntries`. */
export function toEntryFilters(form, search) {
  const toDate = parseLocalDate(form.toDate);
  return {
    habitId: form.habitId || null,
    from: parseLocalDate(form.fromDate),
    to: toDate ? endOfLocalDay(toDate) : null,
    categoryId: form.categoryId || null,
    emotionId: form.emotionId || null,
    intensityMin: form.intensityMin === "" ? null : Number(form.intensityMin),
    intensityMax: form.intensityMax === "" ? null : Number(form.intensityMax),
    outcome: form.outcome || null,
    search: search.trim(),
  };
}

/**
 * One item per active filter: { key, label, cleared }, where `cleared` is the
 * part of the form to reset when the chip's ✕ is pressed.
 */
export function describeActiveFilters(form, habitsById) {
  const active = [];
  if (form.habitId) {
    active.push({ key: "habit", label: habitsById.get(form.habitId)?.name ?? "Habit", cleared: { habitId: "" } });
  }
  if (form.fromDate || form.toDate) {
    const from = form.fromDate ? formatShortDate(parseLocalDate(form.fromDate)) : "start";
    const to = form.toDate ? formatShortDate(parseLocalDate(form.toDate)) : "today";
    active.push({ key: "dates", label: `${from} – ${to}`, cleared: { fromDate: "", toDate: "" } });
  }
  if (form.categoryId) {
    active.push({ key: "category", label: getCategory(form.categoryId)?.label ?? "Category", cleared: { categoryId: "" } });
  }
  if (form.emotionId) {
    active.push({ key: "emotion", label: getEmotionDisplayName(form.emotionId), cleared: { emotionId: "" } });
  }
  if (form.intensityMin !== "" || form.intensityMax !== "") {
    active.push({
      key: "intensity",
      label: `Intensity ${form.intensityMin || 1}–${form.intensityMax || 10}`,
      cleared: { intensityMin: "", intensityMax: "" },
    });
  }
  if (form.outcome) {
    active.push({
      key: "outcome",
      label: form.outcome === OUTCOME_FILTER_NONE ? "Outcome not recorded" : getOutcomeLabel(form.outcome),
      cleared: { outcome: "" },
    });
  }
  return active;
}
