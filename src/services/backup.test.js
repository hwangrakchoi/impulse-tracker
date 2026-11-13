import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  IMPORT_MODES,
  applyImportPlan,
  buildBackup,
  buildImportPlan,
  entriesToCsv,
  parseBackupText,
  previewImport,
  serializeBackup,
  toCsvCell,
  validateBackup,
} from "./backup.js";
import { db } from "../db/database.js";
import { createHabit, listHabits } from "../db/habitsRepository.js";
import { createEntry, listEntries, updateEntry } from "../db/entriesRepository.js";
import { contextTagsRepository } from "../db/namedListRepository.js";
import { deleteAllData, readAllData } from "../db/maintenance.js";
import { getSettings, updateSettings } from "../db/settingsRepository.js";
import { DEFAULT_CONTEXT_TAGS } from "../data/defaults.js";
import { at, makeEntry, makeHabit } from "../test/factories.js";

/** Saves two habits and three entries, like a small real data set. */
async function seedSampleData() {
  const alcohol = await createHabit({ name: "Alcohol", icon: "wine" });
  const vaping = await createHabit({ name: "Vaping" });
  const customTag = await contextTagsRepository.create("On the train");
  const first = await createEntry({
    habitId: alcohol.id,
    emotionIds: ["sad.lonely", "sad.depressed.empty", "disgust.awful"],
    timestamp: at(2026, 10, 13, 17, 45),
    intensity: 8,
    contextTagIds: ["tag-alone", customTag.id],
    copingStrategyIds: ["strategy-journaling"],
    outcome: "passed",
    situationalNotes: 'Said "no", then went home',
    notes: "Line one\nLine two",
  });
  const second = await createEntry({ habitId: alcohol.id, emotionIds: ["fear.anxious"], timestamp: at(2026, 10, 14, 20, 20) });
  const third = await createEntry({ habitId: vaping.id, emotionIds: ["anger.frustrated"], timestamp: at(2026, 10, 15, 8, 0), outcome: "ongoing" });
  return { alcohol, vaping, customTag, first, second, third };
}

/** Export → JSON text → parse → validate, as the Settings page does. */
async function exportAndValidate() {
  const text = serializeBackup(await buildBackup());
  const parsed = parseBackupText(text);
  expect(parsed.ok).toBe(true);
  const validated = validateBackup(parsed.value);
  expect(validated.errors).toEqual([]);
  return validated;
}

describe("JSON export", () => {
  it("includes everything needed to restore, plus versions and emotion references", async () => {
    await seedSampleData();
    await updateSettings({ theme: "dark", privacyLock: { salt: "s", hash: "h", iterations: 1 } });

    const backup = await buildBackup();

    expect(backup).toMatchObject({ app: "emotional-trigger-tracker", formatVersion: BACKUP_FORMAT_VERSION, databaseSchemaVersion: 1 });
    expect(backup.data.habits).toHaveLength(2);
    expect(backup.data.entries).toHaveLength(3);
    expect(backup.data.contextTags).toHaveLength(DEFAULT_CONTEXT_TAGS.length + 1);
    expect(backup.data.settings.theme).toBe("dark");
    // The PIN hash never leaves the device.
    expect(JSON.stringify(backup)).not.toContain("privacyLock");
    expect(backup.emotionReferences).toContainEqual({
      id: "sad.depressed.empty",
      label: "Empty",
      level: 3,
      categoryId: "sad",
      parentId: "sad.depressed",
    });
  });
});

describe("import validation", () => {
  it("rejects text that is not JSON", () => {
    expect(parseBackupText("definitely { not json").ok).toBe(false);
  });

  it("rejects files from other apps and from newer versions", () => {
    expect(validateBackup({ hello: "world" }).ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
    const tooNew = validateBackup({ app: "emotional-trigger-tracker", formatVersion: BACKUP_FORMAT_VERSION + 1, data: {} });
    expect(tooNew.ok).toBe(false);
    expect(tooNew.errors[0]).toMatch(/newer version/);
  });

  it("rejects damaged records and explains which ones", () => {
    const result = validateBackup({
      app: "emotional-trigger-tracker",
      formatVersion: 1,
      data: {
        habits: [{ id: "h1", name: "Alcohol" }, { id: "", name: "No id" }],
        entries: [
          { id: "e1", habitId: "missing-habit", emotionIds: ["sad.lonely"], timestamp: "2026-10-13T17:45:00.000Z" },
          { id: "e2", habitId: "h1", emotionIds: [], timestamp: "2026-10-13T17:45:00.000Z" },
          { id: "e3", habitId: "h1", emotionIds: ["sad.lonely"], timestamp: "not a date" },
          { id: "e4", habitId: "h1", emotionIds: ["sad.lonely"], timestamp: "2026-10-13T17:45:00.000Z", intensity: 42 },
        ],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "Habit #2 is missing its ID or name.",
      "Entry #1 refers to a habit that is not in the file.",
      "Entry #2 has no emotions.",
      "Entry #3 has no valid date and time.",
      "Entry #4 has an intensity outside 1–10.",
    ]);
    expect(result.data).toBeUndefined();
  });

  it("accepts unknown emotion IDs and duplicate IDs with a warning", () => {
    const result = validateBackup({
      app: "emotional-trigger-tracker",
      formatVersion: 1,
      data: {
        habits: [
          { id: "h1", name: "Alcohol", updatedAt: "2026-10-01T00:00:00.000Z" },
          { id: "h1", name: "Alcohol (renamed)", updatedAt: "2026-10-05T00:00:00.000Z" },
        ],
        entries: [{ id: "e1", habitId: "h1", emotionIds: ["future.emotion"], timestamp: "2026-10-13T17:45:00.000Z", contextTagIds: ["ghost-tag"] }],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.habits).toHaveLength(1);
    expect(result.data.habits[0].name).toBe("Alcohol (renamed)");
    expect(result.data.entries[0].contextTagIds).toEqual([]);
    expect(result.warnings).toHaveLength(3);
  });
});

describe("export → import round trip", () => {
  it("restores an erased device exactly", async () => {
    await seedSampleData();
    const before = await readAllData();
    const { data } = await exportAndValidate();

    await deleteAllData();
    expect(await listEntries()).toHaveLength(0);

    const plan = await previewImport(data, IMPORT_MODES.MERGE);
    expect(plan.stats.habits).toMatchObject({ inFile: 2, added: 2 });
    expect(plan.stats.entries).toMatchObject({ inFile: 3, added: 3, updated: 0 });
    await applyImportPlan(plan);

    const after = await readAllData();
    const sortById = (list) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(after.habits)).toEqual(sortById(before.habits));
    expect(sortById(after.entries)).toEqual(sortById(before.entries));
    expect(sortById(after.contextTags).map((tag) => tag.name)).toEqual(sortById(before.contextTags).map((tag) => tag.name));
  });

  it("importing the same backup twice changes nothing", async () => {
    await seedSampleData();
    const { data } = await exportAndValidate();
    const before = await readAllData();

    const plan = await previewImport(data);
    expect(plan.stats.entries).toMatchObject({ added: 0, updated: 0, unchanged: 3 });
    expect(plan.stats.habits).toMatchObject({ added: 0, updated: 0, unchanged: 2 });
    await applyImportPlan(plan);

    expect(await readAllData()).toEqual(before);
  });

  it("merging keeps newer local edits and local-only records", async () => {
    const { first, alcohol } = await seedSampleData();
    const { data } = await exportAndValidate();

    // After the backup: edit one entry and add another on the device.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await updateEntry(first.id, { notes: "Edited after the backup" });
    const localOnly = await createEntry({ habitId: alcohol.id, emotionIds: ["happy.proud"], timestamp: at(2026, 10, 20) });

    const plan = await previewImport(data);
    expect(plan.stats.entries).toMatchObject({ added: 0, updated: 0, unchanged: 3 });
    await applyImportPlan(plan);

    const entries = await listEntries();
    expect(entries).toHaveLength(4);
    expect(entries.find((entry) => entry.id === first.id).notes).toBe("Edited after the backup");
    expect(entries.some((entry) => entry.id === localOnly.id)).toBe(true);
  });

  it("merging lets a newer copy in the file replace an older local one", async () => {
    const { first } = await seedSampleData();
    const { data } = await exportAndValidate();
    const newerInFile = {
      ...data,
      entries: data.entries.map((entry) =>
        entry.id === first.id ? { ...entry, intensity: 3, updatedAt: new Date(Date.now() + 60_000).toISOString() } : entry,
      ),
    };

    const plan = await previewImport(newerInFile);
    expect(plan.stats.entries).toMatchObject({ updated: 1, unchanged: 2 });
    await applyImportPlan(plan);

    expect((await listEntries()).find((entry) => entry.id === first.id).intensity).toBe(3);
  });

  it("replace mode erases the device first but keeps the privacy PIN", async () => {
    await seedSampleData();
    const { data } = await exportAndValidate();

    await deleteAllData();
    const other = await createHabit({ name: "Gambling" });
    await createEntry({ habitId: other.id, emotionIds: ["happy.joyful"], timestamp: at(2026, 10, 1) });
    await updateSettings({ theme: "light", privacyLock: { salt: "s", hash: "h", iterations: 1 } });

    const plan = await previewImport(data, IMPORT_MODES.REPLACE);
    expect(plan.stats.habits).toMatchObject({ added: 2, removedFromDevice: 1 });
    expect(plan.stats.entries).toMatchObject({ added: 3, removedFromDevice: 1 });
    await applyImportPlan(plan);

    expect((await listHabits()).map((habit) => habit.name).sort()).toEqual(["Alcohol", "Vaping"]);
    expect(await listEntries()).toHaveLength(3);
    expect((await getSettings()).privacyLock).toEqual({ salt: "s", hash: "h", iterations: 1 });
  });
});

describe("import conflict handling", () => {
  const current = {
    habits: [makeHabit({ id: "local-alcohol", name: "Alcohol" })],
    entries: [],
    contextTags: [{ id: "tag-alone", name: "Alone", updatedAt: "2026-10-01T00:00:00.000Z" }, { id: "local-train", name: "On the train", updatedAt: "2026-10-01T00:00:00.000Z" }],
    copingStrategies: [],
  };
  const incoming = {
    habits: [makeHabit({ id: "other-alcohol", name: "alcohol" }), makeHabit({ id: "other-vaping", name: "Vaping" })],
    entries: [
      makeEntry({ id: "e1", habitId: "other-alcohol", contextTagIds: ["other-train", "tag-alone"] }),
      makeEntry({ id: "e2", habitId: "other-vaping" }),
    ],
    contextTags: [{ id: "tag-alone", name: "Alone", updatedAt: "2026-10-01T00:00:00.000Z" }, { id: "other-train", name: "on the TRAIN", updatedAt: "2026-10-01T00:00:00.000Z" }],
    copingStrategies: [],
    settings: {},
  };

  it("matches same-named habits and tags instead of duplicating them", () => {
    const plan = buildImportPlan(incoming, current, IMPORT_MODES.MERGE);

    expect(plan.stats.habits).toMatchObject({ added: 1, matchedByName: 1 });
    expect(plan.writes.habits.map((habit) => habit.id)).toEqual(["other-vaping"]);
    expect(plan.stats.contextTags).toMatchObject({ added: 0, unchanged: 1, matchedByName: 1 });
    expect(plan.nameMatches).toEqual([
      { kind: "habit", name: "Alcohol" },
      { kind: "tag", name: "On the train" },
    ]);
    // The imported entry now points at the device's own habit and tag.
    const entry = plan.writes.entries.find((item) => item.id === "e1");
    expect(entry.habitId).toBe("local-alcohol");
    expect(entry.contextTagIds).toEqual(["local-train", "tag-alone"]);
    expect(plan.settings).toBeNull();
  });

  it("does not modify the database when an import fails part-way", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    const plan = buildImportPlan(incoming, await readAllData(), IMPORT_MODES.MERGE);
    // Sabotage the plan: a record without a primary key makes the write fail.
    plan.writes.entries.push({ habitId: habit.id, emotionIds: ["sad.lonely"] });

    await expect(applyImportPlan(plan)).rejects.toThrow();

    expect((await listHabits()).map((item) => item.name)).toEqual(["Alcohol"]);
    expect(await db.entries.count()).toBe(0);
  });
});

describe("CSV export", () => {
  it("escapes commas, quotes and line breaks, and neutralises formulas", () => {
    expect(toCsvCell("plain")).toBe("plain");
    expect(toCsvCell("a, b")).toBe('"a, b"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(toCsvCell("two\nlines")).toBe('"two\nlines"');
    expect(toCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(toCsvCell(8)).toBe("8");
    expect(toCsvCell(null)).toBe("");
  });

  it("writes one row per entry, newest first, with readable names", async () => {
    const { alcohol, vaping } = await seedSampleData();
    const { habits, entries, contextTags, copingStrategies } = await readAllData();
    const toMap = (list) => new Map(list.map((item) => [item.id, item]));

    const csv = entriesToCsv(entries, {
      habitsById: toMap(habits),
      tagsById: toMap(contextTags),
      strategiesById: toMap(copingStrategies),
    });
    const lines = csv.split("\r\n");

    expect(lines[0].startsWith("Date,Time,Timestamp (UTC),Habit,Emotions,Emotion categories")).toBe(true);
    expect(lines[1]).toContain(`,${vaping.name},Frustrated,Anger,,Still ongoing,`);
    expect(lines[2]).toContain(`,${alcohol.name},Anxious,Fear,,Not recorded,`);
    const oldest = lines.slice(3).join("\r\n");
    expect(oldest).toContain("2026-10-13,17:45,");
    expect(oldest).toContain("Lonely; Empty; Awful,Disgust; Sad,8,Urge passed,");
    expect(oldest).toContain("Alone; On the train,Journaling,");
    expect(oldest).toContain('"Said ""no"", then went home","Line one\nLine two"');
  });
});
