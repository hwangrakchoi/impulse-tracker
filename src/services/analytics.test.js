import { describe, expect, it } from "vitest";
import {
  analyzeCopingStrategies,
  buildFrequencySeries,
  buildHabitCategoryMatrix,
  buildTimeOfDayDistribution,
  countCategoryInvolvement,
  countEmotionSelections,
  countReferences,
  filterEntries,
  getDayPartId,
  getEntryCategoryIds,
  sortEntries,
  summarizeHabit,
  summarizeOutcomes,
  summarizeTotals,
} from "./analytics.js";
import { at, makeEntry, makeHabit } from "../test/factories.js";

const byCategory = (result) => Object.fromEntries(result.categories.map((item) => [item.categoryId, item]));

describe("category involvement (each category at most once per entry)", () => {
  it("counts a category once even when an entry has several of its emotions", () => {
    const entries = [
      // Three Sad emotions + one Disgust emotion in ONE urge.
      makeEntry({ emotionIds: ["sad.lonely", "sad.depressed.empty", "sad.bored", "disgust.awful"] }),
    ];
    const result = countCategoryInvolvement(entries);
    const categories = byCategory(result);

    expect(result.urgeEvents).toBe(1);
    expect(categories.sad.events).toBe(1);
    expect(categories.disgust.events).toBe(1);
    expect(categories.fear.events).toBe(0);
    expect(result.categoryInvolvements).toBe(2);
  });

  it("lets one urge contribute to several categories, so shares can exceed 100% in total", () => {
    const entries = [
      makeEntry({ emotionIds: ["sad.lonely", "fear.anxious"] }),
      makeEntry({ emotionIds: ["sad.bored", "fear.rejected"] }),
      makeEntry({ emotionIds: ["fear.anxious"] }),
      makeEntry({ emotionIds: ["anger.mad"] }),
    ];
    const result = countCategoryInvolvement(entries);
    const categories = byCategory(result);

    expect(result.urgeEvents).toBe(4); // never double-counted
    expect(categories.sad.shareOfUrges).toBe(0.5);
    expect(categories.fear.shareOfUrges).toBe(0.75);
    expect(categories.anger.shareOfUrges).toBe(0.25);
    const totalShare = result.categories.reduce((sum, item) => sum + item.shareOfUrges, 0);
    expect(totalShare).toBeGreaterThan(1);
    expect(result.categoryInvolvements).toBe(6);
  });

  it("returns all six categories with zero counts and null shares when there is no data", () => {
    const result = countCategoryInvolvement([]);
    expect(result.categories).toHaveLength(6);
    expect(result.categories.every((item) => item.events === 0 && item.shareOfUrges === null)).toBe(true);
  });

  it("ignores emotion IDs that are not on the wheel", () => {
    expect(getEntryCategoryIds(makeEntry({ emotionIds: ["gone.forever", "sad.lonely"] }))).toEqual(["sad"]);
  });
});

describe("emotion selections", () => {
  const entries = [
    makeEntry({ emotionIds: ["sad.lonely", "sad.depressed.empty", "disgust.awful"] }),
    makeEntry({ emotionIds: ["sad.lonely", "fear.anxious"] }),
    makeEntry({ emotionIds: ["sad.lonely"] }),
    makeEntry({ emotionIds: ["fear.anxious"] }),
  ];

  it("distinguishes urge events from emotion selections", () => {
    expect(summarizeTotals(entries)).toMatchObject({ urgeEvents: 4, emotionSelections: 7 });
  });

  it("ranks individual emotions with counts and both kinds of percentage", () => {
    const { emotions, emotionSelections, urgeEvents } = countEmotionSelections(entries);
    expect(urgeEvents).toBe(4);
    expect(emotionSelections).toBe(7);
    expect(emotions.map((item) => [item.displayName, item.count])).toEqual([
      ["Lonely", 3],
      ["Anxious", 2],
      ["Awful", 1],
      ["Empty", 1],
    ]);
    expect(emotions[0].shareOfUrges).toBe(0.75); // 3 of 4 urges
    expect(emotions[0].shareOfSelections).toBeCloseTo(3 / 7);
    expect(emotions[0].categoryId).toBe("sad");
  });

  it("keeps same-named emotions separate", () => {
    const { emotions } = countEmotionSelections([
      makeEntry({ emotionIds: ["fear.insecure.inadequate", "fear.rejected.inadequate"] }),
    ]);
    expect(emotions.map((item) => item.displayName).sort()).toEqual(["Inadequate (Insecure)", "Inadequate (Rejected)"]);
  });
});

describe("habit × category matrix", () => {
  it("builds one row per habit with entries, including archived habits", () => {
    const alcohol = makeHabit({ id: "alcohol", name: "Alcohol" });
    const vaping = makeHabit({ id: "vaping", name: "Vaping", isArchived: true });
    const unused = makeHabit({ id: "unused", name: "Unused" });
    const entries = [
      makeEntry({ habitId: "alcohol", emotionIds: ["sad.lonely", "sad.bored", "disgust.awful"] }),
      makeEntry({ habitId: "alcohol", emotionIds: ["sad.lonely"] }),
      makeEntry({ habitId: "vaping", emotionIds: ["fear.anxious", "anger.mad"] }),
    ];

    const rows = buildHabitCategoryMatrix(entries, [vaping, unused, alcohol]);

    expect(rows.map((row) => row.habitName)).toEqual(["Alcohol", "Vaping"]);
    expect(rows[0]).toMatchObject({ urgeEvents: 2, sad: 2, disgust: 1, fear: 0 });
    expect(rows[1]).toMatchObject({ urgeEvents: 1, fear: 1, anger: 1, sad: 0, isArchived: true });
  });
});

describe("frequency over time", () => {
  const entries = [
    makeEntry({ timestamp: at(2026, 11, 9, 8) }),
    makeEntry({ timestamp: at(2026, 11, 9, 23, 59) }),
    makeEntry({ timestamp: at(2026, 11, 12, 0, 0) }),
  ];

  it("counts per local day and fills quiet days with zero", () => {
    const series = buildFrequencySeries(entries, { granularity: "day" });
    expect(series.map((point) => [point.key, point.urgeEvents])).toEqual([
      ["2026-11-09", 2],
      ["2026-11-10", 0],
      ["2026-11-11", 0],
      ["2026-11-12", 1],
    ]);
    expect(series.reduce((sum, point) => sum + point.urgeEvents, 0)).toBe(entries.length);
  });

  it("extends to an explicit range", () => {
    const series = buildFrequencySeries(entries, { granularity: "day", from: at(2026, 11, 8), to: at(2026, 11, 13) });
    expect(series).toHaveLength(6);
    expect(series[0]).toMatchObject({ key: "2026-11-08", urgeEvents: 0 });
  });

  it("groups by week, starting on the given weekday", () => {
    // 9 Nov 2026 is a Monday; with Monday-start weeks all three fall in one week.
    const mondayWeeks = buildFrequencySeries(entries, { granularity: "week", firstDayOfWeek: 1 });
    expect(mondayWeeks.map((point) => [point.key, point.urgeEvents])).toEqual([["2026-11-09", 3]]);
    const sundayWeeks = buildFrequencySeries(
      [...entries, makeEntry({ timestamp: at(2026, 11, 15, 10) })],
      { granularity: "week", firstDayOfWeek: 0 },
    );
    expect(sundayWeeks.map((point) => [point.key, point.urgeEvents])).toEqual([
      ["2026-11-08", 3],
      ["2026-11-15", 1],
    ]);
  });

  it("returns an empty series when there is nothing to plot", () => {
    expect(buildFrequencySeries([])).toEqual([]);
  });
});

describe("time of day", () => {
  const entries = [
    makeEntry({ timestamp: at(2026, 11, 9, 0, 30) }),
    makeEntry({ timestamp: at(2026, 11, 9, 18, 5) }),
    makeEntry({ timestamp: at(2026, 11, 10, 20, 59) }),
    makeEntry({ timestamp: at(2026, 11, 11, 23, 0) }),
  ];

  it("groups into hourly blocks", () => {
    const blocks = buildTimeOfDayDistribution(entries, 1);
    expect(blocks).toHaveLength(24);
    expect(blocks[0].urgeEvents).toBe(1);
    expect(blocks[18].urgeEvents).toBe(1);
    expect(blocks[20].urgeEvents).toBe(1);
    expect(blocks[23].urgeEvents).toBe(1);
  });

  it("groups into configurable blocks whose counts add up to the total", () => {
    const blocks = buildTimeOfDayDistribution(entries, 6);
    expect(blocks.map((block) => [block.label, block.urgeEvents])).toEqual([
      ["12 AM–6 AM", 1],
      ["6 AM–12 PM", 0],
      ["12 PM–6 PM", 0],
      ["6 PM–12 AM", 3],
    ]);
    expect(blocks[3].shareOfUrges).toBe(0.75);
  });

  it("assigns parts of the day", () => {
    expect(getDayPartId(at(2026, 11, 9, 5))).toBe("morning");
    expect(getDayPartId(at(2026, 11, 9, 12))).toBe("afternoon");
    expect(getDayPartId(at(2026, 11, 9, 17))).toBe("evening");
    expect(getDayPartId(at(2026, 11, 9, 22))).toBe("late-night");
    expect(getDayPartId(at(2026, 11, 9, 4, 59))).toBe("late-night");
  });
});

describe("outcomes and coping strategies", () => {
  const entries = [
    makeEntry({ copingStrategyIds: ["walk"], outcome: "passed" }),
    makeEntry({ copingStrategyIds: ["walk"], outcome: "passed" }),
    makeEntry({ copingStrategyIds: ["walk", "read"], outcome: "engaged" }),
    makeEntry({ copingStrategyIds: ["walk"], outcome: "ongoing" }),
    makeEntry({ copingStrategyIds: ["read"], outcome: null }),
    makeEntry({ outcome: "engaged" }),
  ];

  it("summarises outcomes without dropping unrecorded ones", () => {
    expect(summarizeOutcomes(entries)).toEqual({
      passed: 2,
      engaged: 2,
      ongoing: 1,
      notRecorded: 1,
      resolved: 4,
      urgeEvents: 6,
    });
  });

  it("computes a pass rate only from entries with a known outcome", () => {
    const { strategies, overall } = analyzeCopingStrategies(entries);
    const walk = strategies.find((item) => item.strategyId === "walk");
    const read = strategies.find((item) => item.strategyId === "read");

    expect(walk).toMatchObject({ timesRecorded: 4, passed: 2, engaged: 1, ongoing: 1, resolved: 3 });
    expect(walk.passedRate).toBeCloseTo(2 / 3);
    // Only one resolved entry → too little data for a percentage.
    expect(read).toMatchObject({ timesRecorded: 2, resolved: 1, passedRate: null });
    expect(overall).toMatchObject({ resolved: 4, passed: 2, passedRate: 0.5 });
  });

  it("counts tag references once per entry", () => {
    const tagged = [
      makeEntry({ contextTagIds: ["alone", "tired", "alone"] }),
      makeEntry({ contextTagIds: ["alone"] }),
      makeEntry({}),
    ];
    expect(countReferences(tagged, "contextTagIds")).toEqual([
      { id: "alone", count: 2, shareOfUrges: 2 / 3 },
      { id: "tired", count: 1, shareOfUrges: 1 / 3 },
    ]);
  });
});

describe("habit summary", () => {
  it("summarises one habit's entries", () => {
    const entries = [
      makeEntry({ emotionIds: ["sad.lonely", "sad.bored"], intensity: 8, contextTagIds: ["alone"], outcome: "passed", timestamp: at(2026, 11, 1) }),
      makeEntry({ emotionIds: ["sad.lonely", "fear.anxious"], intensity: 6, contextTagIds: ["alone", "tired"], copingStrategyIds: ["walk"], timestamp: at(2026, 11, 5) }),
      makeEntry({ emotionIds: ["sad.lonely"], timestamp: at(2026, 11, 3) }),
    ];
    const summary = summarizeHabit(entries);

    expect(summary.urgeEvents).toBe(3);
    expect(summary.mostFrequentEmotions.map((item) => item.displayName)).toEqual(["Lonely"]);
    expect(summary.mostFrequentCategories.map((item) => item.categoryId)).toEqual(["sad"]);
    expect(summary.averageIntensity).toBe(7); // mean of the two recorded values
    expect(summary.entriesWithIntensity).toBe(2);
    expect(summary.topContextTags[0]).toMatchObject({ id: "alone", count: 2 });
    expect(summary.topCopingStrategies).toEqual([{ id: "walk", count: 1, shareOfUrges: 1 / 3 }]);
    expect(summary.outcomes).toMatchObject({ passed: 1, notRecorded: 2 });
    expect(summary.firstTimestamp).toBe(at(2026, 11, 1));
    expect(summary.lastTimestamp).toBe(at(2026, 11, 5));
  });

  it("reports ties instead of picking a winner arbitrarily", () => {
    const summary = summarizeHabit([
      makeEntry({ emotionIds: ["sad.lonely"] }),
      makeEntry({ emotionIds: ["fear.anxious"] }),
    ]);
    expect(summary.mostFrequentEmotions.map((item) => item.displayName)).toEqual(["Anxious", "Lonely"]);
    expect(summary.mostFrequentCategories.map((item) => item.categoryId).sort()).toEqual(["fear", "sad"]);
  });

  it("copes with a habit that has no entries", () => {
    expect(summarizeHabit([])).toMatchObject({
      urgeEvents: 0,
      mostFrequentEmotions: [],
      mostFrequentCategories: [],
      averageIntensity: null,
      firstTimestamp: null,
    });
  });
});

describe("filtering and sorting history", () => {
  const habitsById = new Map([
    ["alcohol", makeHabit({ id: "alcohol", name: "Alcohol" })],
    ["vaping", makeHabit({ id: "vaping", name: "Vaping" })],
  ]);
  const tagsById = new Map([["tag-alone", { id: "tag-alone", name: "Alone" }]]);
  const strategiesById = new Map([["walk", { id: "walk", name: "Going for a walk" }]]);
  const lookups = { habitsById, tagsById, strategiesById };

  const lonely = makeEntry({ id: "lonely", habitId: "alcohol", emotionIds: ["sad.lonely", "sad.depressed.empty", "disgust.disappointed"], intensity: 8, timestamp: at(2026, 11, 13, 17, 45), contextTagIds: ["tag-alone"], outcome: "engaged" });
  const anxious = makeEntry({ id: "anxious", habitId: "alcohol", emotionIds: ["fear.anxious", "fear.rejected", "disgust.awful"], intensity: 6, timestamp: at(2026, 11, 14, 20, 20), notes: "Argument with Sam", outcome: "passed" });
  const vape = makeEntry({ id: "vape", habitId: "vaping", emotionIds: ["anger.frustrated"], timestamp: at(2026, 11, 10, 9, 0), copingStrategyIds: ["walk"], situationalNotes: "Stuck in traffic" });
  const entries = [lonely, anxious, vape];
  const ids = (filters) => filterEntries(entries, filters, lookups).map((entry) => entry.id);

  it("returns everything when no filter is set", () => {
    expect(ids({})).toEqual(["lonely", "anxious", "vape"]);
  });

  it("filters by habit", () => {
    expect(ids({ habitId: "alcohol" })).toEqual(["lonely", "anxious"]);
  });

  it("filters by an inclusive date range", () => {
    expect(ids({ from: at(2026, 11, 13, 0, 0), to: at(2026, 11, 13, 23, 59) })).toEqual(["lonely"]);
    expect(ids({ from: at(2026, 11, 14, 0, 0) })).toEqual(["anxious"]);
    expect(ids({ to: at(2026, 11, 10, 23, 59) })).toEqual(["vape"]);
  });

  it("filters by primary category and by specific emotion", () => {
    expect(ids({ categoryId: "disgust" })).toEqual(["lonely", "anxious"]);
    expect(ids({ categoryId: "sad" })).toEqual(["lonely"]);
    expect(ids({ emotionId: "fear.rejected" })).toEqual(["anxious"]);
  });

  it("filters by intensity, leaving out entries with none recorded", () => {
    expect(ids({ intensityMin: 7 })).toEqual(["lonely"]);
    expect(ids({ intensityMin: 1, intensityMax: 6 })).toEqual(["anxious"]);
  });

  it("filters by outcome, including 'not recorded'", () => {
    expect(ids({ outcome: "passed" })).toEqual(["anxious"]);
    expect(ids({ outcome: "none" })).toEqual(["vape"]);
  });

  it("searches notes, situations, tags, strategies, habits and emotions", () => {
    expect(ids({ search: "argument" })).toEqual(["anxious"]);
    expect(ids({ search: "TRAFFIC" })).toEqual(["vape"]);
    expect(ids({ search: "alone" })).toEqual(["lonely"]);
    expect(ids({ search: "walk" })).toEqual(["vape"]);
    expect(ids({ search: "vaping" })).toEqual(["vape"]);
    expect(ids({ search: "empty" })).toEqual(["lonely"]);
    expect(ids({ search: "zzz" })).toEqual([]);
  });

  it("combines filters", () => {
    expect(ids({ habitId: "alcohol", categoryId: "disgust", outcome: "passed" })).toEqual(["anxious"]);
  });

  it("sorts newest or oldest first without changing the input", () => {
    expect(sortEntries(entries, "newest").map((entry) => entry.id)).toEqual(["anxious", "lonely", "vape"]);
    expect(sortEntries(entries, "oldest").map((entry) => entry.id)).toEqual(["vape", "lonely", "anxious"]);
    expect(entries.map((entry) => entry.id)).toEqual(["lonely", "anxious", "vape"]);
  });
});
