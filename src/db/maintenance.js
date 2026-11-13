/**
 * Whole-database operations: reading everything (for backups) and erasing
 * everything (the "Delete all data" button).
 */
import { db, seedDefaults } from "./database.js";

/** Reads every table in one consistent snapshot. */
export async function readAllData() {
  return db.transaction("r", db.habits, db.entries, db.contextTags, db.copingStrategies, db.settings, async () => {
    const [habits, entries, contextTags, copingStrategies, settingsRows] = await Promise.all([
      db.habits.toArray(),
      db.entries.toArray(),
      db.contextTags.toArray(),
      db.copingStrategies.toArray(),
      db.settings.toArray(),
    ]);
    const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
    return { habits, entries, contextTags, copingStrategies, settings };
  });
}

/**
 * Permanently erases every habit, entry, tag, strategy and setting on this
 * device, then restores the starter tags and strategies so the app is back to
 * its first-run state. This cannot be undone.
 */
export async function deleteAllData() {
  await db.transaction("rw", db.habits, db.entries, db.contextTags, db.copingStrategies, db.settings, async () => {
    await Promise.all([
      db.habits.clear(),
      db.entries.clear(),
      db.contextTags.clear(),
      db.copingStrategies.clear(),
      db.settings.clear(),
    ]);
    await seedDefaults(db);
  });
}
