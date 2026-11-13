/**
 * Proves that records survive when the app ships a new database version.
 *
 * There is only one real schema version so far, so the test invents a
 * "version 2" (an extra index plus a data upgrade) to exercise the same
 * mechanism future versions will use.
 */
import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS, createDatabase } from "./database.js";
import { DEFAULT_CONTEXT_TAGS } from "../data/defaults.js";

const TEST_DB_NAME = "migration-test-db";

afterEach(async () => {
  await Dexie.delete(TEST_DB_NAME);
});

describe("database schema", () => {
  it("lists versions in increasing order with no gaps in history", () => {
    const versions = SCHEMA_VERSIONS.map((entry) => entry.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(CURRENT_SCHEMA_VERSION).toBe(versions.at(-1));
  });

  it("seeds starter tags only when the database is first created", async () => {
    const first = createDatabase(TEST_DB_NAME);
    await first.open();
    const tagToRemove = DEFAULT_CONTEXT_TAGS[0].id;
    await first.table("contextTags").delete(tagToRemove);
    first.close();

    // Re-opening (as happens on every app start) must not bring it back.
    const reopened = createDatabase(TEST_DB_NAME);
    await reopened.open();
    expect(await reopened.table("contextTags").get(tagToRemove)).toBeUndefined();
    expect(await reopened.table("contextTags").count()).toBe(DEFAULT_CONTEXT_TAGS.length - 1);
    reopened.close();
  });

  it("keeps existing records when a newer schema version is installed", async () => {
    // 1. A device running today's version stores some data.
    const oldDatabase = createDatabase(TEST_DB_NAME);
    await oldDatabase.open();
    await oldDatabase.table("habits").add({ id: "h1", name: "Alcohol", createdAt: "2026-11-01T00:00:00.000Z" });
    await oldDatabase.table("entries").add({
      id: "e1",
      habitId: "h1",
      emotionIds: ["sad.lonely", "disgust.awful"],
      timestamp: "2026-11-13T17:45:00.000Z",
      outcome: null,
    });
    await oldDatabase.table("settings").put({ key: "theme", value: "dark" });
    oldDatabase.close();

    // 2. The app is updated: a new version adds an index and reshapes entries.
    const nextVersion = CURRENT_SCHEMA_VERSION + 1;
    const newDatabase = createDatabase(TEST_DB_NAME, [
      ...SCHEMA_VERSIONS,
      {
        version: nextVersion,
        stores: { entries: "id, habitId, timestamp, outcome, intensity, *emotionIds, *contextTagIds, *copingStrategyIds" },
        upgrade: (transaction) =>
          transaction
            .table("entries")
            .toCollection()
            .modify((entry) => {
              entry.emotionCount = entry.emotionIds.length;
            }),
      },
    ]);
    await newDatabase.open();

    // 3. Everything is still there, and the upgrade step ran.
    expect(newDatabase.verno).toBe(nextVersion);
    expect(await newDatabase.table("habits").get("h1")).toMatchObject({ name: "Alcohol" });
    expect(await newDatabase.table("entries").get("e1")).toMatchObject({
      habitId: "h1",
      emotionIds: ["sad.lonely", "disgust.awful"],
      timestamp: "2026-11-13T17:45:00.000Z",
      emotionCount: 2,
    });
    expect(await newDatabase.table("settings").get("theme")).toEqual({ key: "theme", value: "dark" });
    // Starter tags are not duplicated or reset by an upgrade.
    expect(await newDatabase.table("contextTags").count()).toBe(DEFAULT_CONTEXT_TAGS.length);
    newDatabase.close();
  });
});
