/**
 * Plain-language insights
 * =======================
 * Turns the user's own records into short observations such as
 * "Lonely appeared in 7 of your last 12 recorded Alcohol urges."
 *
 * Rules this file follows:
 *   - Every number in a sentence is counted directly from the entries passed
 *     in. Nothing is estimated, predicted or made up.
 *   - Sentences describe what was RECORDED ("you recorded…", "appeared in…").
 *     They never say one thing causes another.
 *   - Each rule has a minimum sample size and stays silent below it.
 *   - No external service is involved – it is all simple counting.
 */
import { getCategory, getEmotionDisplayName } from "../data/emotionTaxonomy.js";
import {
  analyzeCopingStrategies,
  countByDayPart,
  countCategoryInvolvement,
  countEmotionSelections,
  countReferences,
  groupBy,
  sortEntries,
} from "./analytics.js";
import { formatPercent } from "../utils/text.js";

/** No insights at all until this many urges have been logged. */
export const MIN_ENTRIES_FOR_INSIGHTS = 5;
const MIN_ENTRIES_PER_HABIT = 5;
const RECENT_WINDOW = 12;
const MAX_INSIGHTS = 5;

/**
 * @returns {Array<{ id: string, text: string, basis: string }>}
 *   `text` is the observation; `basis` says how much data it rests on.
 */
export function generateInsights({ entries, habits, tagsById, strategiesById }) {
  if (entries.length < MIN_ENTRIES_FOR_INSIGHTS) return [];

  const habitsById = new Map(habits.map((habit) => [habit.id, habit]));
  const entriesByHabit = groupBy(entries, (entry) => entry.habitId);
  // Habits with enough entries to say anything, busiest first.
  const habitGroups = Array.from(entriesByHabit, ([habitId, habitEntries]) => ({
    habit: habitsById.get(habitId),
    habitEntries,
  }))
    .filter((group) => group.habit && group.habitEntries.length >= MIN_ENTRIES_PER_HABIT)
    .sort((a, b) => b.habitEntries.length - a.habitEntries.length);

  // One list per kind of insight…
  const insightsByKind = [
    habitGroups.map(recentEmotionInsight),
    habitGroups.map(timeOfDayInsight),
    categoryComparisonInsights(habitGroups, entries),
    copingInsights(entries, strategiesById),
    [contextTagInsight(entries, tagsById)],
  ].map((list) => list.filter(Boolean));

  // …then take one of each kind in turn, so the short list shown to the user
  // is varied rather than five sentences of the same type.
  const insights = [];
  const longest = Math.max(...insightsByKind.map((list) => list.length));
  for (let round = 0; round < longest; round += 1) {
    for (const list of insightsByKind) {
      if (list[round]) insights.push(list[round]);
    }
  }
  return insights.slice(0, MAX_INSIGHTS);
}

/** "Lonely appeared in 7 of your last 12 recorded Alcohol urges." */
function recentEmotionInsight({ habit, habitEntries }) {
  const recent = sortEntries(habitEntries, "newest").slice(0, RECENT_WINDOW);
  const top = countEmotionSelections(recent).emotions[0];
  if (!top || top.count < 3 || top.count / recent.length < 0.5) return null;
  return {
    id: `recent-emotion:${habit.id}`,
    text: `“${getEmotionDisplayName(top.emotionId)}” appeared in ${top.count} of your last ${recent.length} recorded ${habit.name} urges.`,
    basis: `Based on your ${recent.length} most recent ${habit.name} entries.`,
  };
}

/** "You recorded more Alcohol urges in the evening (7) than in the morning (2)." */
function timeOfDayInsight({ habit, habitEntries }) {
  const parts = countByDayPart(habitEntries).sort((a, b) => b.urgeEvents - a.urgeEvents);
  const [top, second] = parts;
  const isClearLead = top.urgeEvents >= 3 && top.urgeEvents > second.urgeEvents && top.urgeEvents / habitEntries.length >= 0.4;
  if (!isClearLead) return null;
  return {
    id: `time-of-day:${habit.id}`,
    text: `You recorded more ${habit.name} urges ${top.phrase} (${top.urgeEvents}) than ${second.phrase} (${second.urgeEvents}), the next most common time.`,
    basis: `Based on ${habitEntries.length} ${habit.name} entries, grouped by the time you logged for each urge.`,
  };
}

/**
 * "Fear-related emotions were recorded in 6 of 10 Vaping urges (60%),
 *  compared with 3 of 15 urges (20%) for your other habits."
 * Needs at least two habits with enough entries; keeps the biggest gaps.
 */
function categoryComparisonInsights(habitGroups, allEntries) {
  if (habitGroups.length < 2) return [];
  const candidates = [];

  for (const { habit, habitEntries } of habitGroups) {
    const otherEntries = allEntries.filter((entry) => entry.habitId !== habit.id);
    if (otherEntries.length < MIN_ENTRIES_PER_HABIT) continue;

    const mine = countCategoryInvolvement(habitEntries).categories;
    const others = new Map(countCategoryInvolvement(otherEntries).categories.map((item) => [item.categoryId, item]));

    for (const item of mine) {
      const other = others.get(item.categoryId);
      const gap = item.shareOfUrges - other.shareOfUrges;
      if (item.events >= 3 && gap >= 0.25) {
        candidates.push({
          gap,
          insight: {
            id: `category-comparison:${habit.id}:${item.categoryId}`,
            text: `${getCategory(item.categoryId).label}-related emotions were recorded in ${item.events} of ${habitEntries.length} ${habit.name} urges (${formatPercent(item.shareOfUrges)}), compared with ${other.events} of ${otherEntries.length} urges (${formatPercent(other.shareOfUrges)}) for your other habits.`,
            basis: "Each urge counts once per emotion category, however many emotions were chosen.",
          },
        });
      }
    }
  }

  return candidates
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 2)
    .map((candidate) => candidate.insight);
}

/** "When you recorded 'Going for a walk', the urge passed in 4 of 5 entries…" */
function copingInsights(entries, strategiesById) {
  const { strategies } = analyzeCopingStrategies(entries);
  const usable = strategies
    .filter((item) => item.resolved >= 4 && strategiesById?.get(item.strategyId))
    .sort((a, b) => b.passedRate - a.passedRate || b.resolved - a.resolved);
  const best = usable[0];
  if (!best || best.passed < 2) return [];
  const name = strategiesById.get(best.strategyId).name;
  return [
    {
      id: `coping:${best.strategyId}`,
      text: `When you recorded “${name}”, the urge passed without engaging in ${best.passed} of ${best.resolved} entries that have an outcome.`,
      basis: "An association in your own records, not proof that the strategy caused the result.",
    },
  ];
}

/** "'Alone' was tagged in 9 of your 20 recorded urges." */
function contextTagInsight(entries, tagsById) {
  const top = countReferences(entries, "contextTagIds").find((item) => tagsById?.get(item.id));
  if (!top || top.count < 4 || top.shareOfUrges < 0.4) return null;
  return {
    id: `context-tag:${top.id}`,
    text: `“${tagsById.get(top.id).name}” was tagged in ${top.count} of your ${entries.length} recorded urges.`,
    basis: "Counts only entries where you added context tags; untagged urges may have shared the same context.",
  };
}
