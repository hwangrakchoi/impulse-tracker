import { describe, expect, it } from "vitest";
import { MIN_ENTRIES_FOR_INSIGHTS, generateInsights } from "./insights.js";
import { at, makeEntry, makeHabit } from "../test/factories.js";

const alcohol = makeHabit({ id: "alcohol", name: "Alcohol" });
const vaping = makeHabit({ id: "vaping", name: "Vaping" });
const tagsById = new Map([["tag-alone", { id: "tag-alone", name: "Alone" }]]);
const strategiesById = new Map([["walk", { id: "walk", name: "Going for a walk" }]]);

const run = (entries, habits = [alcohol, vaping]) => generateInsights({ entries, habits, tagsById, strategiesById });
const repeat = (count, makeOne) => Array.from({ length: count }, (_, index) => makeOne(index));

describe("insights", () => {
  it("says nothing until there is enough data", () => {
    const entries = repeat(MIN_ENTRIES_FOR_INSIGHTS - 1, () => makeEntry({ habitId: "alcohol" }));
    expect(run(entries)).toEqual([]);
  });

  it("reports how often an emotion appeared in recent urges for a habit", () => {
    const entries = [
      ...repeat(7, (index) => makeEntry({ habitId: "alcohol", emotionIds: ["sad.lonely", "fear.anxious"], timestamp: at(2026, 11, 1 + index, 9) })),
      ...repeat(5, (index) => makeEntry({ habitId: "alcohol", emotionIds: ["anger.mad"], timestamp: at(2026, 10, 1 + index, 9) })),
      // An older entry outside the 12 most recent must not be counted.
      makeEntry({ habitId: "alcohol", emotionIds: ["sad.lonely"], timestamp: at(2026, 9, 1, 9) }),
    ];
    const texts = run(entries).map((insight) => insight.text);
    expect(texts).toContain("“Anxious” appeared in 7 of your last 12 recorded Alcohol urges.");
  });

  it("reports a clear time-of-day cluster using the real counts", () => {
    const entries = [
      ...repeat(7, (index) => makeEntry({ habitId: "alcohol", timestamp: at(2026, 11, 1 + index, 19) })),
      ...repeat(2, (index) => makeEntry({ habitId: "alcohol", timestamp: at(2026, 11, 1 + index, 8) })),
    ];
    const insight = run(entries).find((item) => item.id === "time-of-day:alcohol");
    expect(insight.text).toBe(
      "You recorded more Alcohol urges in the evening (7) than in the morning (2), the next most common time.",
    );
  });

  it("stays silent about time of day when no period clearly leads", () => {
    const entries = [
      ...repeat(3, (index) => makeEntry({ habitId: "alcohol", timestamp: at(2026, 11, 1 + index, 19) })),
      ...repeat(3, (index) => makeEntry({ habitId: "alcohol", timestamp: at(2026, 11, 1 + index, 8) })),
    ];
    expect(run(entries).some((item) => item.id.startsWith("time-of-day"))).toBe(false);
  });

  it("compares a habit's category share with the other habits", () => {
    const entries = [
      ...repeat(6, () => makeEntry({ habitId: "vaping", emotionIds: ["fear.anxious", "sad.lonely"] })),
      ...repeat(4, () => makeEntry({ habitId: "vaping", emotionIds: ["sad.lonely"] })),
      ...repeat(3, () => makeEntry({ habitId: "alcohol", emotionIds: ["fear.scared", "sad.lonely"] })),
      ...repeat(12, () => makeEntry({ habitId: "alcohol", emotionIds: ["sad.lonely"] })),
    ];
    const texts = run(entries).map((insight) => insight.text);
    expect(texts).toContain(
      "Fear-related emotions were recorded in 6 of 10 Vaping urges (60%), compared with 3 of 15 urges (20%) for your other habits.",
    );
  });

  it("describes coping strategies as an association, never as a cause", () => {
    const entries = [
      ...repeat(4, () => makeEntry({ habitId: "alcohol", copingStrategyIds: ["walk"], outcome: "passed" })),
      makeEntry({ habitId: "alcohol", copingStrategyIds: ["walk"], outcome: "engaged" }),
      makeEntry({ habitId: "alcohol", copingStrategyIds: ["walk"], outcome: "ongoing" }),
    ];
    const insight = run(entries).find((item) => item.id === "coping:walk");
    expect(insight.text).toBe(
      "When you recorded “Going for a walk”, the urge passed without engaging in 4 of 5 entries that have an outcome.",
    );
    expect(insight.basis).toMatch(/not proof/i);
  });

  it("mentions a context tag that appears in a large share of urges", () => {
    const entries = [
      ...repeat(9, () => makeEntry({ habitId: "alcohol", contextTagIds: ["tag-alone"] })),
      ...repeat(11, () => makeEntry({ habitId: "alcohol" })),
    ];
    const texts = run(entries).map((insight) => insight.text);
    expect(texts).toContain("“Alone” was tagged in 9 of your 20 recorded urges.");
  });

  it("never uses causal language and never returns more than five insights", () => {
    const entries = [
      ...repeat(10, (index) => makeEntry({ habitId: "vaping", emotionIds: ["fear.anxious"], contextTagIds: ["tag-alone"], copingStrategyIds: ["walk"], outcome: "passed", timestamp: at(2026, 11, 1 + index, 20) })),
      ...repeat(10, (index) => makeEntry({ habitId: "alcohol", emotionIds: ["sad.lonely"], contextTagIds: ["tag-alone"], timestamp: at(2026, 11, 1 + index, 7) })),
    ];
    const insights = run(entries);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.length).toBeLessThanOrEqual(5);
    for (const insight of insights) {
      expect(insight.text).not.toMatch(/\b(cause[sd]?|because|leads? to|makes you|triggers?)\b/i);
    }
  });
});
