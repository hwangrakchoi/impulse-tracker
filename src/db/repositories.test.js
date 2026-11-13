import { describe, expect, it } from "vitest";
import { db } from "./database.js";
import { NotFoundError, ValidationError } from "./errors.js";
import {
  countEntriesForHabit,
  createHabit,
  deleteHabit,
  listHabits,
  setHabitArchived,
  updateHabit,
} from "./habitsRepository.js";
import {
  createEntry,
  deleteEntry,
  getEntry,
  listEntries,
  updateEntry,
  updateEntryOutcome,
} from "./entriesRepository.js";
import { contextTagsRepository, copingStrategiesRepository } from "./namedListRepository.js";
import { getSettings, updateSettings } from "./settingsRepository.js";
import { deleteAllData } from "./maintenance.js";
import { DEFAULT_CONTEXT_TAGS, DEFAULT_COPING_STRATEGIES } from "../data/defaults.js";
import { at } from "../test/factories.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("habits repository", () => {
  it("creates a habit with an ID, defaults and timestamps", async () => {
    const habit = await createHabit({ name: "  Alcohol  " });
    expect(habit.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(habit.name).toBe("Alcohol");
    expect(habit.isArchived).toBe(false);
    expect(habit.icon).toBe("circle-dot");
    expect(habit.accentColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(habit.createdAt).toBe(habit.updatedAt);
    expect(await listHabits()).toHaveLength(1);
  });

  it("rejects an empty name and a duplicate name", async () => {
    await expect(createHabit({ name: "   " })).rejects.toBeInstanceOf(ValidationError);
    await createHabit({ name: "Vaping" });
    await expect(createHabit({ name: "vaping" })).rejects.toMatchObject({
      fieldErrors: { name: expect.stringContaining("already have") },
    });
  });

  it("edits a habit and keeps its creation time", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await wait(5);
    const updated = await updateHabit(habit.id, { name: "Drinking", description: "Evenings", icon: "wine", accentColor: "#A8559F" });
    expect(updated).toMatchObject({ name: "Drinking", description: "Evenings", icon: "wine", accentColor: "#a8559f" });
    expect(updated.createdAt).toBe(habit.createdAt);
    expect(updated.updatedAt > habit.updatedAt).toBe(true);
    await expect(updateHabit("missing", { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("archives and reactivates without touching the habit's entries", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) });

    expect((await setHabitArchived(habit.id, true)).isArchived).toBe(true);
    expect(await countEntriesForHabit(habit.id)).toBe(1);
    expect((await setHabitArchived(habit.id, false)).isArchived).toBe(false);
  });

  it("deleting a habit also deletes its entries, and only its entries", async () => {
    const alcohol = await createHabit({ name: "Alcohol" });
    const vaping = await createHabit({ name: "Vaping" });
    await createEntry({ habitId: alcohol.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 12) });
    await createEntry({ habitId: alcohol.id, emotionIds: ["fear.anxious"], timestamp: at(2026, 10, 13) });
    await createEntry({ habitId: vaping.id, emotionIds: ["anger.mad"], timestamp: at(2026, 10, 13) });

    const result = await deleteHabit(alcohol.id);

    expect(result.deletedEntryCount).toBe(2);
    expect((await listHabits()).map((habit) => habit.name)).toEqual(["Vaping"]);
    expect((await listEntries()).map((entry) => entry.habitId)).toEqual([vaping.id]);
  });
});

describe("entries repository", () => {
  it("logs an urge with an ID, timestamps and tidy defaults", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    const entry = await createEntry({
      habitId: habit.id,
      emotionIds: ["sad.lonely", "sad.depressed.empty", "disgust.awful", "sad.lonely"],
      timestamp: at(2026, 10, 13, 17, 45),
    });

    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    // Selecting the same emotion twice is stored once.
    expect(entry.emotionIds).toEqual(["sad.lonely", "sad.depressed.empty", "disgust.awful"]);
    expect(entry.timestamp).toBe(at(2026, 10, 13, 17, 45));
    expect(entry).toMatchObject({ intensity: null, outcome: null, outcomeUpdatedAt: null, contextTagIds: [], notes: "" });
    expect(entry.createdAt).toBe(entry.updatedAt);
    expect(await getEntry(entry.id)).toEqual(entry);
  });

  it("requires a habit, at least one emotion and a sensible timestamp", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await expect(createEntry({ habitId: "", emotionIds: [], timestamp: "nope" })).rejects.toMatchObject({
      fieldErrors: {
        habitId: expect.any(String),
        emotionIds: expect.any(String),
        timestamp: expect.any(String),
      },
    });
    await expect(
      createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: new Date(Date.now() + 86_400_000).toISOString() }),
    ).rejects.toMatchObject({ fieldErrors: { timestamp: expect.stringContaining("future") } });
    await expect(
      createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13), intensity: 11 }),
    ).rejects.toMatchObject({ fieldErrors: { intensity: expect.any(String) } });
    await expect(
      createEntry({ habitId: "ghost", emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await listEntries()).toHaveLength(0);
  });

  it("does not require an outcome, and never judges one", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    const engaged = await createEntry({
      habitId: habit.id,
      emotionIds: ["sad.lonely"],
      timestamp: at(2026, 10, 13),
      outcome: "engaged",
    });
    expect(engaged.outcome).toBe("engaged");
    expect(engaged.outcomeUpdatedAt).toBe(engaged.createdAt);
  });

  it("lists entries newest first", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 12, 9) });
    await createEntry({ habitId: habit.id, emotionIds: ["fear.anxious"], timestamp: at(2026, 10, 13, 20) });
    await createEntry({ habitId: habit.id, emotionIds: ["anger.mad"], timestamp: at(2026, 10, 13, 8) });
    expect((await listEntries()).map((entry) => entry.emotionIds[0])).toEqual(["fear.anxious", "anger.mad", "sad.lonely"]);
  });

  it("edits an entry while keeping its ID and creation time", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    const entry = await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13, 17) });
    await wait(5);
    const updated = await updateEntry(entry.id, { emotionIds: ["fear.anxious", "fear.rejected"], intensity: 6, notes: " Rough day " });

    expect(updated.id).toBe(entry.id);
    expect(updated.createdAt).toBe(entry.createdAt);
    expect(updated.timestamp).toBe(entry.timestamp);
    expect(updated.updatedAt > entry.updatedAt).toBe(true);
    expect(updated).toMatchObject({ emotionIds: ["fear.anxious", "fear.rejected"], intensity: 6, notes: "Rough day" });
    await expect(updateEntry("missing", { intensity: 3 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("follows up an ongoing urge without changing when the urge happened", async () => {
    const habit = await createHabit({ name: "Vaping" });
    const entry = await createEntry({
      habitId: habit.id,
      emotionIds: ["fear.anxious"],
      timestamp: at(2026, 10, 13, 9, 30),
      outcome: "ongoing",
    });
    await wait(5);
    const followedUp = await updateEntryOutcome(entry.id, "passed");

    expect(followedUp.outcome).toBe("passed");
    expect(followedUp.timestamp).toBe(entry.timestamp);
    expect(followedUp.outcomeUpdatedAt > entry.outcomeUpdatedAt).toBe(true);

    // Editing something else later leaves the outcome time alone.
    await wait(5);
    const edited = await updateEntry(entry.id, { notes: "Went for a walk" });
    expect(edited.outcomeUpdatedAt).toBe(followedUp.outcomeUpdatedAt);
  });

  it("deletes an entry", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    const entry = await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) });
    await deleteEntry(entry.id);
    expect(await getEntry(entry.id)).toBeUndefined();
  });
});

describe("context tags and coping strategies", () => {
  it("starts with the built-in lists", async () => {
    expect(await contextTagsRepository.list()).toHaveLength(DEFAULT_CONTEXT_TAGS.length);
    expect(await copingStrategiesRepository.list()).toHaveLength(DEFAULT_COPING_STRATEGIES.length);
  });

  it("creates custom items but never duplicates a name", async () => {
    const created = await contextTagsRepository.create("  On the  train ");
    expect(created.name).toBe("On the train");
    const again = await contextTagsRepository.create("on the TRAIN");
    expect(again.id).toBe(created.id);
    expect(await contextTagsRepository.list()).toHaveLength(DEFAULT_CONTEXT_TAGS.length + 1);
    await expect(contextTagsRepository.create("")).rejects.toBeInstanceOf(ValidationError);
  });

  it("renames, and refuses a name that is already taken", async () => {
    const tag = await contextTagsRepository.create("Commuting");
    expect((await contextTagsRepository.rename(tag.id, "Commute")).name).toBe("Commute");
    await expect(contextTagsRepository.rename(tag.id, "alone")).rejects.toBeInstanceOf(ValidationError);
  });

  it("removing a strategy takes it off entries but keeps the entries", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    const strategy = await copingStrategiesRepository.create("Cold shower");
    const entry = await createEntry({
      habitId: habit.id,
      emotionIds: ["sad.lonely"],
      timestamp: at(2026, 10, 13),
      copingStrategyIds: [strategy.id, "strategy-exercise"],
    });
    expect(await copingStrategiesRepository.countUsage(strategy.id)).toBe(1);

    const result = await copingStrategiesRepository.remove(strategy.id);

    expect(result.affectedEntryCount).toBe(1);
    expect((await getEntry(entry.id)).copingStrategyIds).toEqual(["strategy-exercise"]);
  });
});

describe("settings and maintenance", () => {
  it("returns defaults until a setting is saved", async () => {
    expect((await getSettings()).theme).toBe("system");
    await updateSettings({ theme: "dark", reflectionPromptsEnabled: false });
    expect(await getSettings()).toMatchObject({ theme: "dark", reflectionPromptsEnabled: false, trendGranularity: "day" });
  });

  it("delete-all erases everything and restores the starter lists", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) });
    await contextTagsRepository.create("Custom tag");
    await updateSettings({ theme: "dark" });

    await deleteAllData();

    expect(await db.habits.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
    expect(await db.contextTags.count()).toBe(DEFAULT_CONTEXT_TAGS.length);
  });
});
