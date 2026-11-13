/**
 * The local database
 * ==================
 * All data is kept on the device in IndexedDB, the browser's built-in
 * database. We talk to it through Dexie.js, a small library that makes
 * IndexedDB far easier to use.
 *
 * Only the files in src/db/ import this module. Pages and components go
 * through the repository functions (habitsRepository.js, …) so that the
 * storage technology could be swapped – or a cloud sync added – without
 * rewriting the UI.
 *
 * Schema versions and migrations
 * ------------------------------
 * IndexedDB databases have a version number. To change the structure later:
 *   1. ADD a new object to SCHEMA_VERSIONS (never edit an old one).
 *   2. List only the tables whose indexes change in `stores`.
 *   3. Optionally add an `upgrade(transaction)` function that rewrites
 *      existing records into the new shape.
 * When a phone that still has the old version opens the updated app, Dexie
 * runs the missing steps in order and keeps every existing record.
 *
 * A store definition lists the INDEXED fields only (the ones we search or
 * sort by). Records can hold any other fields too. The first name is the
 * primary key; a leading "*" means "this field is an array – index each item".
 */
import Dexie from "dexie";
import { DEFAULT_CONTEXT_TAGS, DEFAULT_COPING_STRATEGIES } from "../data/defaults.js";

export const DB_NAME = "emotional-trigger-tracker";

export const SCHEMA_VERSIONS = [
  {
    version: 1,
    stores: {
      // { id, name, description, icon, accentColor, isArchived, createdAt, updatedAt }
      habits: "id, name, createdAt",
      // { id, habitId, emotionIds[], timestamp, intensity, contextTagIds[],
      //   situationalNotes, notes, copingStrategyIds[], outcome, outcomeUpdatedAt,
      //   reflectionPrompt, reflectionResponse, createdAt, updatedAt }
      entries: "id, habitId, timestamp, outcome, *emotionIds, *contextTagIds, *copingStrategyIds",
      // { id, name, createdAt, updatedAt }
      contextTags: "id, name",
      // { id, name, createdAt, updatedAt }
      copingStrategies: "id, name",
      // { key, value } – one row per setting
      settings: "key",
    },
  },
];

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;

/** Adds the starter tags and coping strategies to an empty database. */
export async function seedDefaults(database) {
  const timestamp = new Date().toISOString();
  const withTimestamps = (item) => ({ ...item, createdAt: timestamp, updatedAt: timestamp });
  await database.table("contextTags").bulkPut(DEFAULT_CONTEXT_TAGS.map(withTimestamps));
  await database.table("copingStrategies").bulkPut(DEFAULT_COPING_STRATEGIES.map(withTimestamps));
}

/**
 * Builds a Dexie database object. The app uses the single shared `db` below;
 * tests call this with a different name or extra versions.
 */
export function createDatabase(name = DB_NAME, versions = SCHEMA_VERSIONS) {
  const database = new Dexie(name);

  for (const { version, stores, upgrade } of versions) {
    const definition = database.version(version).stores(stores);
    if (upgrade) definition.upgrade(upgrade);
  }

  // "populate" fires exactly once: when the database is created for the very
  // first time on a device. It does NOT fire on app updates.
  database.on("populate", (transaction) => seedDefaults(transaction));

  // If another tab opens a NEWER version of the app, this (older) tab must let
  // go of the database so the upgrade can proceed, then reload itself.
  database.on("versionchange", () => {
    database.close();
    if (typeof window !== "undefined" && import.meta.env?.MODE !== "test") {
      window.location.reload();
    }
  });

  return database;
}

/** The one database instance used by the running app. */
export const db = createDatabase();

/** True when the browser offers IndexedDB at all (some private modes do not). */
export function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

/**
 * Asks the browser to treat our storage as "persistent", i.e. not to clear it
 * automatically when the device runs low on space. Browsers may say no; apps
 * added to the iPhone Home Screen are already protected from the 7-day
 * cleanup Safari applies to ordinary websites.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isStoragePersistent() {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}
