import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_IDS,
  CHART_CATEGORY_ORDER,
  EMOTIONS,
  EMOTION_LEVELS,
  PRIMARY_EMOTIONS,
  getCategoryIdsForEmotions,
  getChildEmotions,
  getEmotion,
  getEmotionDisplayName,
  getEmotionPathLabel,
  resolveEmotion,
} from "./emotionTaxonomy.js";

// The secondary emotions exactly as transcribed in the project brief.
const BRIEF_SECONDARY = {
  anger: ["Hurt", "Threatened", "Hateful", "Mad", "Aggressive", "Frustrated", "Distant", "Critical"],
  disgust: ["Disapproval", "Disappointed", "Awful", "Avoidance"],
  sad: ["Guilty", "Abandoned", "Despair", "Depressed", "Lonely", "Bored"],
  happy: ["Optimistic", "Intimate", "Peaceful", "Powerful", "Accepted", "Proud", "Interested", "Joyful"],
  surprise: ["Startled", "Confused", "Amazed", "Excited"],
  fear: ["Scared", "Anxious", "Insecure", "Submissive", "Rejected", "Humiliated"],
};

describe("emotion taxonomy", () => {
  it("has the six primary categories in wheel order", () => {
    expect(PRIMARY_EMOTIONS.map((emotion) => emotion.label)).toEqual([
      "Anger",
      "Disgust",
      "Sad",
      "Happy",
      "Surprise",
      "Fear",
    ]);
  });

  it("matches the secondary emotions from the brief exactly", () => {
    for (const [categoryId, labels] of Object.entries(BRIEF_SECONDARY)) {
      expect(getChildEmotions(categoryId).map((emotion) => emotion.label)).toEqual(labels);
    }
  });

  it("gives every emotion a unique ID", () => {
    const ids = EMOTIONS.map((emotion) => emotion.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 6 primary, 36 secondary and 72 tertiary emotions", () => {
    const countAtLevel = (level) => EMOTIONS.filter((emotion) => emotion.level === level).length;
    expect(countAtLevel(EMOTION_LEVELS.PRIMARY)).toBe(6);
    expect(countAtLevel(EMOTION_LEVELS.SECONDARY)).toBe(36);
    expect(countAtLevel(EMOTION_LEVELS.TERTIARY)).toBe(72);
  });

  it("links every emotion to a valid parent, category and color", () => {
    for (const emotion of EMOTIONS) {
      expect(CATEGORY_IDS).toContain(emotion.categoryId);
      expect(emotion.color).toMatch(/^#[0-9a-f]{6}$/);
      if (emotion.level === EMOTION_LEVELS.PRIMARY) {
        expect(emotion.parentId).toBeNull();
        expect(emotion.secondaryId).toBeNull();
      } else {
        const parent = getEmotion(emotion.parentId);
        expect(parent).toBeDefined();
        expect(parent.level).toBe(emotion.level - 1);
        expect(parent.categoryId).toBe(emotion.categoryId);
      }
      if (emotion.level === EMOTION_LEVELS.TERTIARY) expect(emotion.secondaryId).toBe(emotion.parentId);
    }
  });

  it("keeps repeated labels apart with distinct IDs and display names", () => {
    const inadequate = EMOTIONS.filter((emotion) => emotion.label === "Inadequate");
    expect(inadequate.map((emotion) => emotion.id)).toEqual([
      "fear.insecure.inadequate",
      "fear.rejected.inadequate",
    ]);
    expect(getEmotionDisplayName("fear.insecure.inadequate")).toBe("Inadequate (Insecure)");
    expect(getEmotionDisplayName("fear.rejected.inadequate")).toBe("Inadequate (Rejected)");
    // "Abandoned" is both a secondary emotion and a tertiary one under Lonely.
    expect(getEmotionDisplayName("sad.abandoned")).toBe("Abandoned (Sad)");
    expect(getEmotionDisplayName("sad.lonely.abandoned")).toBe("Abandoned (Lonely)");
    // A label that occurs once is shown as-is.
    expect(getEmotionDisplayName("sad.lonely")).toBe("Lonely");
  });

  it("places the emotions used in the acceptance test where expected", () => {
    expect(getEmotion("sad.lonely").categoryId).toBe("sad");
    expect(getEmotion("sad.depressed.empty").label).toBe("Empty");
    expect(getEmotion("disgust.awful").categoryId).toBe("disgust");
    expect(getEmotionPathLabel("sad.depressed.empty")).toBe("Sad › Depressed › Empty");
  });

  it("returns each category once, in wheel order, for a set of emotions", () => {
    expect(getCategoryIdsForEmotions(["fear.anxious", "sad.lonely", "sad.bored", "sad.depressed.empty"])).toEqual([
      "sad",
      "fear",
    ]);
    expect(getCategoryIdsForEmotions(["not-a-real-id"])).toEqual([]);
  });

  it("degrades gracefully for IDs it does not know", () => {
    const unknown = resolveEmotion("removed.emotion");
    expect(unknown.label).toBe("Unknown emotion");
    expect(unknown.categoryId).toBeNull();
    expect(getEmotionDisplayName("removed.emotion")).toBe("Unknown emotion");
  });

  it("uses a chart order that contains every category exactly once", () => {
    expect([...CHART_CATEGORY_ORDER].sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it("stays in sync with the color tokens in tokens.css", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    const lightBlock = css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)"));
    const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'));
    for (const category of PRIMARY_EMOTIONS) {
      expect(lightBlock).toContain(`${category.colorVar}: ${category.color};`);
      expect(darkBlock).toContain(`${category.colorVar}: ${category.colorDark};`);
    }
  });
});
