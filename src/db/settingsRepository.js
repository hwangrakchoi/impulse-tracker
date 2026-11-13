/**
 * Settings repository.
 *
 * Settings are stored as one row per setting: { key: "theme", value: "dark" }.
 * Anything not saved yet falls back to DEFAULT_SETTINGS, so adding a new
 * setting in a later version needs no database migration.
 */
import { db } from "./database.js";
import { DEFAULT_SETTINGS } from "../data/defaults.js";

/** All settings as one object, with defaults filled in. */
export async function getSettings() {
  const rows = await db.settings.toArray();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

/** Saves several settings at once: updateSettings({ theme: "dark" }). */
export async function updateSettings(changes) {
  await db.settings.bulkPut(Object.entries(changes).map(([key, value]) => ({ key, value })));
}
