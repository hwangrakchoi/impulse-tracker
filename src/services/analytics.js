/**
 * Analytics – pure calculation functions
 * ======================================
 * Every function here takes plain arrays of entries and returns plain
 * numbers/objects. Nothing reads the database or touches React, which makes
 * the maths easy to unit-test (see analytics.test.js).
 *
 * Three different things can be counted, and mixing them up would mislead:
 *
 *   1. URGE EVENTS          – one per saved entry. "How many urges?"
 *   2. EMOTION SELECTIONS   – one per emotion chosen. An entry with Lonely,
 *                             Empty and Anxious adds 3.
 *   3. CATEGORY INVOLVEMENT – per primary category, the number of ENTRIES that
 *                             include at least one emotion from it. An entry
 *                             with Lonely + Empty (both Sad) adds 1 to Sad,
 *                             not 2. An entry with Lonely + Anxious adds 1 to
 *                             Sad AND 1 to Fear – so category percentages can
 *                             add up to more than 100%.
 *
 * Function and field names say which of the three they mean.
 */
import {
  CHART_CATEGORY_ORDER,
  getCategory,
  getCategoryIdsForEmotions,
  getEmotion,
  getEmotionDisplayName,
  resolveEmotion,
} from "../data/emotionTaxonomy.js";
import { OUTCOMES, OUTCOME_FILTER_NONE } from "../data/defaults.js";
import {
  addDays,
  endOfLocalDay,
  formatHourLabel,
  formatShortDate,
  startOfLocalDay,
  startOfLocalWeek,
  toDate,
  toLocalDateKey,
} from "../utils/dates.js";
import { nameKey, ratio } from "../utils/text.js";

/** Below these sample sizes we show counts but no percentages or claims. */
export const MIN_ENTRIES_FOR_PERCENTAGES = 5;
export const MIN_RESOLVED_FOR_COPING_RATE = 3;

// ---------------------------------------------------------------------------
// Filtering and sorting
// ---------------------------------------------------------------------------

/** The distinct primary categories an entry involves (each at most once). */
export function getEntryCategoryIds(entry) {
  return getCategoryIdsForEmotions(entry.emotionIds);
}

/**
 * Returns the entries that match every filter that is set.
 *
 * filters = {
 *   habitId, from, to, categoryId, emotionId,
 *   intensityMin, intensityMax,         (entries with no intensity are
 *                                         excluded once either is set)
 *   outcome,                             "passed" | "engaged" | "ongoing" | "none"
 *   search,                              free text
 * }
 * lookups = { habitsById, tagsById, strategiesById } – Maps used so the text
 * search can match habit, tag and strategy NAMES, not just IDs.
 */
export function filterEntries(entries, filters = {}, lookups = {}) {
  const fromTime = filters.from ? toDate(filters.from).getTime() : null;
  const toTime = filters.to ? toDate(filters.to).getTime() : null;
  const hasIntensityFilter =
    (filters.intensityMin !== null && filters.intensityMin !== undefined) ||
    (filters.intensityMax !== null && filters.intensityMax !== undefined);
  const searchKey = filters.search ? nameKey(filters.search) : "";

  return entries.filter((entry) => {
    if (filters.habitId && entry.habitId !== filters.habitId) return false;

    const entryTime = Date.parse(entry.timestamp);
    if (fromTime !== null && entryTime < fromTime) return false;
    if (toTime !== null && entryTime > toTime) return false;

    if (filters.categoryId && !getEntryCategoryIds(entry).includes(filters.categoryId)) return false;
    if (filters.emotionId && !entry.emotionIds.includes(filters.emotionId)) return false;

    if (hasIntensityFilter) {
      if (entry.intensity === null || entry.intensity === undefined) return false;
      if (filters.intensityMin != null && entry.intensity < filters.intensityMin) return false;
      if (filters.intensityMax != null && entry.intensity > filters.intensityMax) return false;
    }

    if (filters.outcome) {
      const wanted = filters.outcome === OUTCOME_FILTER_NONE ? null : filters.outcome;
      if ((entry.outcome ?? null) !== wanted) return false;
    }

    if (searchKey && !getEntrySearchText(entry, lookups).includes(searchKey)) return false;

    return true;
  });
}

/** All searchable text of an entry, lower-cased, as one string. */
function getEntrySearchText(entry, { habitsById, tagsById, strategiesById } = {}) {
  const parts = [
    entry.situationalNotes,
    entry.notes,
    entry.reflectionResponse,
    habitsById?.get(entry.habitId)?.name,
    ...(entry.contextTagIds ?? []).map((id) => tagsById?.get(id)?.name),
    ...(entry.copingStrategyIds ?? []).map((id) => strategiesById?.get(id)?.name),
    ...(entry.emotionIds ?? []).map((id) => getEmotion(id)?.label),
  ];
  return nameKey(parts.filter(Boolean).join(" \n "));
}

/** Returns a new array sorted by urge time. direction: "newest" | "oldest". */
export function sortEntries(entries, direction = "newest") {
  const sign = direction === "oldest" ? 1 : -1;
  return [...entries].sort((a, b) => sign * (Date.parse(a.timestamp) - Date.parse(b.timestamp)));
}

// ---------------------------------------------------------------------------
// Headline numbers
// ---------------------------------------------------------------------------

/** Mean intensity over the entries that recorded one. */
export function summarizeIntensity(entries) {
  const values = entries.map((entry) => entry.intensity).filter((value) => typeof value === "number");
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    entriesWithIntensity: values.length,
    averageIntensity: values.length > 0 ? sum / values.length : null,
  };
}

export function summarizeTotals(entries) {
  return {
    urgeEvents: entries.length,
    emotionSelections: entries.reduce((total, entry) => total + new Set(entry.emotionIds).size, 0),
    ...summarizeIntensity(entries),
  };
}

// ---------------------------------------------------------------------------
// A. Category involvement (donut chart)
// ---------------------------------------------------------------------------

/**
 * For each primary category: how many urge events involved it.
 * An entry counts AT MOST ONCE per category, however many emotions it has.
 */
export function countCategoryInvolvement(entries) {
  const eventsByCategory = new Map(CHART_CATEGORY_ORDER.map((categoryId) => [categoryId, 0]));
  for (const entry of entries) {
    for (const categoryId of getEntryCategoryIds(entry)) {
      eventsByCategory.set(categoryId, eventsByCategory.get(categoryId) + 1);
    }
  }

  const urgeEvents = entries.length;
  const categories = CHART_CATEGORY_ORDER.map((categoryId) => {
    const category = getCategory(categoryId);
    const events = eventsByCategory.get(categoryId);
    return {
      categoryId,
      label: category.label,
      colorVar: category.colorVar,
      colorName: category.colorName,
      events,
      // Share of ALL urge events that involved this category.
      shareOfUrges: ratio(events, urgeEvents),
    };
  });

  return {
    urgeEvents,
    // Sum over categories; larger than urgeEvents whenever entries span categories.
    categoryInvolvements: categories.reduce((total, item) => total + item.events, 0),
    categories,
  };
}

/**
 * The categories involved in the most urge events. Usually one item; several
 * when there is an exact tie (we show all of them rather than pick one
 * arbitrarily); empty when there is no data.
 */
export function getTopCategories(entries) {
  const { categories } = countCategoryInvolvement(entries);
  const highest = Math.max(0, ...categories.map((item) => item.events));
  return highest === 0 ? [] : categories.filter((item) => item.events === highest);
}

// ---------------------------------------------------------------------------
// C. Individual emotion selections (ranked chart)
// ---------------------------------------------------------------------------

/**
 * How often each individual emotion was selected, most frequent first.
 * `shareOfUrges` = fraction of urge events that included the emotion.
 */
export function countEmotionSelections(entries) {
  const counts = new Map();
  let emotionSelections = 0;
  for (const entry of entries) {
    for (const emotionId of new Set(entry.emotionIds)) {
      counts.set(emotionId, (counts.get(emotionId) ?? 0) + 1);
      emotionSelections += 1;
    }
  }

  const urgeEvents = entries.length;
  const emotions = Array.from(counts, ([emotionId, count]) => {
    const emotion = resolveEmotion(emotionId);
    return {
      emotionId,
      label: emotion.label,
      displayName: getEmotionDisplayName(emotionId),
      categoryId: emotion.categoryId,
      colorVar: emotion.colorVar,
      count,
      shareOfUrges: ratio(count, urgeEvents),
      shareOfSelections: ratio(count, emotionSelections),
    };
  }).sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));

  return { urgeEvents, emotionSelections, emotions };
}

// ---------------------------------------------------------------------------
// B. Habit × category (stacked bar chart)
// ---------------------------------------------------------------------------

/**
 * One row per habit that has entries: how many of its urge events involved
 * each category. Rows are sorted by number of urges, largest first.
 */
export function buildHabitCategoryMatrix(entries, habits) {
  const entriesByHabit = groupBy(entries, (entry) => entry.habitId);
  return habits
    .filter((habit) => entriesByHabit.has(habit.id))
    .map((habit) => {
      const habitEntries = entriesByHabit.get(habit.id);
      const { categories } = countCategoryInvolvement(habitEntries);
      return {
        habitId: habit.id,
        habitName: habit.name,
        isArchived: Boolean(habit.isArchived),
        urgeEvents: habitEntries.length,
        ...Object.fromEntries(categories.map((item) => [item.categoryId, item.events])),
      };
    })
    .sort((a, b) => b.urgeEvents - a.urgeEvents || a.habitName.localeCompare(b.habitName));
}

// ---------------------------------------------------------------------------
// D. Frequency over time (line chart)
// ---------------------------------------------------------------------------

/**
 * Urge events per day or per week. Periods with no entries are included with
 * a count of 0 so the line does not skip over quiet days.
 *
 * options = { granularity: "day" | "week", from, to, firstDayOfWeek }
 * When from/to are omitted the series spans the first to the last entry.
 */
export function buildFrequencySeries(entries, options = {}) {
  const { granularity = "day", firstDayOfWeek } = options;
  if (entries.length === 0 && !(options.from && options.to)) return [];

  const times = entries.map((entry) => Date.parse(entry.timestamp));
  const rangeStart = options.from ? toDate(options.from) : new Date(Math.min(...times));
  const rangeEnd = options.to ? toDate(options.to) : new Date(Math.max(...times));

  const bucketStart = (value) =>
    granularity === "week" ? startOfLocalWeek(value, firstDayOfWeek) : startOfLocalDay(value);
  const stepDays = granularity === "week" ? 7 : 1;

  const counts = new Map();
  for (const entry of entries) {
    const key = toLocalDateKey(bucketStart(entry.timestamp));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series = [];
  const last = bucketStart(rangeEnd);
  for (let cursor = bucketStart(rangeStart); cursor <= last; cursor = addDays(cursor, stepDays)) {
    const key = toLocalDateKey(cursor);
    series.push({
      key,
      start: cursor,
      end: endOfLocalDay(addDays(cursor, stepDays - 1)),
      label: granularity === "week" ? `Week of ${formatShortDate(cursor)}` : formatShortDate(cursor),
      shortLabel: formatShortDate(cursor),
      urgeEvents: counts.get(key) ?? 0,
    });
  }
  return series;
}

// ---------------------------------------------------------------------------
// E. Time of day (bar chart)
// ---------------------------------------------------------------------------

export const TIME_BLOCK_OPTIONS = [1, 3, 6];

/**
 * Urge events grouped by local time of day, in blocks of `blockHours` hours
 * (1, 2, 3, 4, 6, 8 or 12 – anything that divides 24).
 */
export function buildTimeOfDayDistribution(entries, blockHours = 3) {
  const size = 24 % blockHours === 0 ? blockHours : 3;
  const blocks = [];
  for (let startHour = 0; startHour < 24; startHour += size) {
    blocks.push({
      startHour,
      endHour: startHour + size,
      label: size === 1 ? formatHourLabel(startHour) : `${formatHourLabel(startHour)}–${formatHourLabel(startHour + size)}`,
      shortLabel: formatHourLabel(startHour).replace(" ", "").toLowerCase(),
      urgeEvents: 0,
    });
  }
  for (const entry of entries) {
    const hour = toDate(entry.timestamp).getHours();
    blocks[Math.floor(hour / size)].urgeEvents += 1;
  }
  return blocks.map((block) => ({ ...block, shareOfUrges: ratio(block.urgeEvents, entries.length) }));
}

/** Four broad parts of the day, used for plain-language insights. */
export const DAY_PARTS = [
  { id: "morning", label: "morning", phrase: "in the morning", fromHour: 5, toHour: 12 },
  { id: "afternoon", label: "afternoon", phrase: "in the afternoon", fromHour: 12, toHour: 17 },
  { id: "evening", label: "evening", phrase: "in the evening", fromHour: 17, toHour: 22 },
  { id: "late-night", label: "late night", phrase: "late at night", fromHour: 22, toHour: 5 },
];

export function getDayPartId(value) {
  const hour = toDate(value).getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "late-night";
}

export function countByDayPart(entries) {
  const counts = new Map(DAY_PARTS.map((part) => [part.id, 0]));
  for (const entry of entries) {
    const partId = getDayPartId(entry.timestamp);
    counts.set(partId, counts.get(partId) + 1);
  }
  return DAY_PARTS.map((part) => ({ ...part, urgeEvents: counts.get(part.id) }));
}

// ---------------------------------------------------------------------------
// Tags, strategies and outcomes
// ---------------------------------------------------------------------------

/**
 * Counts how many entries reference each ID in an array field
 * ("contextTagIds" or "copingStrategyIds"), most used first.
 */
export function countReferences(entries, field) {
  const counts = new Map();
  for (const entry of entries) {
    for (const id of new Set(entry[field] ?? [])) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([id, count]) => ({ id, count, shareOfUrges: ratio(count, entries.length) })).sort(
    (a, b) => b.count - a.count,
  );
}

export function summarizeOutcomes(entries) {
  const summary = { passed: 0, engaged: 0, ongoing: 0, notRecorded: 0 };
  for (const entry of entries) {
    if (entry.outcome === OUTCOMES.PASSED) summary.passed += 1;
    else if (entry.outcome === OUTCOMES.ENGAGED) summary.engaged += 1;
    else if (entry.outcome === OUTCOMES.ONGOING) summary.ongoing += 1;
    else summary.notRecorded += 1;
  }
  // "Resolved" = the user recorded how it ended, one way or the other.
  return { ...summary, resolved: summary.passed + summary.engaged, urgeEvents: entries.length };
}

/**
 * For each coping strategy: of the urges where it was recorded AND the
 * outcome is known (passed or engaged), how many passed.
 *
 * This is an observation about the user's own records, not evidence that a
 * strategy works: people may reach for different strategies in different
 * situations. `passedRate` is null until there are enough resolved entries.
 */
export function analyzeCopingStrategies(entries) {
  const overall = summarizeOutcomes(entries);
  const strategies = countReferences(entries, "copingStrategyIds").map(({ id, count }) => {
    const using = entries.filter((entry) => (entry.copingStrategyIds ?? []).includes(id));
    const outcomes = summarizeOutcomes(using);
    return {
      strategyId: id,
      timesRecorded: count,
      passed: outcomes.passed,
      engaged: outcomes.engaged,
      ongoing: outcomes.ongoing,
      notRecorded: outcomes.notRecorded,
      resolved: outcomes.resolved,
      passedRate: outcomes.resolved >= MIN_RESOLVED_FOR_COPING_RATE ? outcomes.passed / outcomes.resolved : null,
    };
  });

  return {
    strategies: strategies.sort((a, b) => b.timesRecorded - a.timesRecorded),
    overall: {
      resolved: overall.resolved,
      passed: overall.passed,
      passedRate: overall.resolved >= MIN_RESOLVED_FOR_COPING_RATE ? overall.passed / overall.resolved : null,
    },
  };
}

// ---------------------------------------------------------------------------
// F. Habit detail page
// ---------------------------------------------------------------------------

/** Everything the habit detail page shows. Pass ONLY that habit's entries. */
export function summarizeHabit(habitEntries) {
  const { emotions } = countEmotionSelections(habitEntries);
  const timestamps = habitEntries.map((entry) => Date.parse(entry.timestamp));
  return {
    urgeEvents: habitEntries.length,
    // Arrays, because several emotions/categories can share first place.
    mostFrequentEmotions: emotions.filter((item) => item.count === emotions[0].count),
    mostFrequentCategories: getTopCategories(habitEntries),
    topEmotions: emotions.slice(0, 8),
    categoryInvolvement: countCategoryInvolvement(habitEntries),
    topContextTags: countReferences(habitEntries, "contextTagIds").slice(0, 5),
    topCopingStrategies: countReferences(habitEntries, "copingStrategyIds").slice(0, 5),
    ...summarizeIntensity(habitEntries),
    outcomes: summarizeOutcomes(habitEntries),
    firstTimestamp: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
    lastTimestamp: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Small shared helper
// ---------------------------------------------------------------------------

/** Groups items into a Map keyed by whatever `getKey(item)` returns. */
export function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}
