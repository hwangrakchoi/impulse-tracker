/**
 * Backup: JSON export / import, and CSV export
 * ============================================
 * Everything here runs on the device. "Export" produces a file the user saves
 * themselves; nothing is uploaded anywhere.
 *
 * The import is deliberately cautious and happens in separate steps:
 *
 *   parseBackupText(text)        file text → JavaScript object (or an error)
 *   validateBackup(object)       checks every record; returns clean data
 *   buildImportPlan(data, mode)  compares with what is on the device and
 *                                works out exactly what WOULD change (preview)
 *   applyImportPlan(plan)        writes the plan in one all-or-nothing step
 *
 * Nothing is written to the database until applyImportPlan runs.
 *
 * Backup file versions
 * --------------------
 * `formatVersion` describes the shape of the backup FILE. If the shape ever
 * changes, bump BACKUP_FORMAT_VERSION and add a function to BACKUP_MIGRATIONS
 * that upgrades the previous shape, so old backup files keep working.
 */
import { db, CURRENT_SCHEMA_VERSION } from "../db/database.js";
import { readAllData } from "../db/maintenance.js";
import { OUTCOMES, DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON, getOutcomeLabel } from "../data/defaults.js";
import {
  TAXONOMY_VERSION,
  getCategory,
  getCategoryIdsForEmotions,
  getEmotionDisplayName,
  getEmotionReferenceList,
  isKnownEmotionId,
} from "../data/emotionTaxonomy.js";
import { isValidIsoTimestamp, nowIso, toDate, toLocalDateKey } from "../utils/dates.js";
import { cleanName, nameKey } from "../utils/text.js";

export const BACKUP_APP_ID = "emotional-trigger-tracker";
export const BACKUP_FORMAT_VERSION = 1;

/** Settings that are safe and useful to carry between devices. */
const PORTABLE_SETTING_KEYS = [
  "theme",
  "onboardingComplete",
  "reflectionPromptsEnabled",
  "logDetailsExpanded",
  "trendGranularity",
  "timeBlockHours",
];

/**
 * Upgrade steps for older backup files: { 1: (backup) => backupInVersion2 }.
 * Empty for now because version 1 is the first format.
 */
const BACKUP_MIGRATIONS = {};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Builds the backup object from everything stored on this device. */
export async function buildBackup() {
  const { habits, entries, contextTags, copingStrategies, settings } = await readAllData();
  const portableSettings = Object.fromEntries(
    PORTABLE_SETTING_KEYS.filter((key) => key in settings).map((key) => [key, settings[key]]),
  );
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(),
    databaseSchemaVersion: CURRENT_SCHEMA_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    data: { habits, entries, contextTags, copingStrategies, settings: portableSettings },
    // A readable copy of the emotion IDs → labels, so the file makes sense on
    // its own. It is informational; the app's own taxonomy stays authoritative.
    emotionReferences: getEmotionReferenceList(),
  };
}

export function serializeBackup(backup) {
  return JSON.stringify(backup, null, 2);
}

export function getBackupFilename(extension, date = new Date()) {
  return `emotional-trigger-tracker-${toLocalDateKey(date)}.${extension}`;
}

// ---------------------------------------------------------------------------
// Import step 1 + 2: parse and validate
// ---------------------------------------------------------------------------

export function parseBackupText(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, errors: ["This file is not valid JSON, so it can't be a backup from this app."] };
  }
}

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const stringArray = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : []);
const isoOr = (value, fallback) => (isValidIsoTimestamp(value) ? new Date(value).toISOString() : fallback);

/** If an ID appears twice in a file, keep the most recently updated copy. */
function dedupeById(records, label, warnings) {
  const byId = new Map();
  let duplicates = 0;
  for (const record of records) {
    const existing = byId.get(record.id);
    if (existing) duplicates += 1;
    if (!existing || (record.updatedAt ?? "") >= (existing.updatedAt ?? "")) byId.set(record.id, record);
  }
  if (duplicates > 0) {
    warnings.push(`${duplicates} duplicate ${label} ID${duplicates === 1 ? "" : "s"} in the file – the most recently updated copy of each is used.`);
  }
  return Array.from(byId.values());
}

/**
 * Checks a parsed backup object thoroughly and returns tidy data.
 *
 * @returns {{ ok: boolean, errors: string[], warnings: string[], data?: object, meta?: object }}
 *   `errors` stop the import. `warnings` are shown but do not stop it.
 */
export function validateBackup(raw) {
  const errors = [];
  const warnings = [];
  const fail = (message) => ({ ok: false, errors: [message], warnings });

  if (!isPlainObject(raw) || raw.app !== BACKUP_APP_ID) {
    return fail("This doesn't look like a backup file from Emotional Trigger Tracker.");
  }
  if (!Number.isInteger(raw.formatVersion) || raw.formatVersion < 1) {
    return fail("The backup file has no valid format version.");
  }
  if (raw.formatVersion > BACKUP_FORMAT_VERSION) {
    return fail("This backup was made by a newer version of the app. Update the app, then import it again.");
  }

  // Bring older file formats up to the current one, one version at a time.
  let backup = raw;
  for (let version = raw.formatVersion; version < BACKUP_FORMAT_VERSION; version += 1) {
    const migrate = BACKUP_MIGRATIONS[version];
    if (!migrate) return fail(`Backups in format version ${version} can no longer be read.`);
    backup = migrate(backup);
  }

  const source = backup.data;
  if (!isPlainObject(source)) return fail("The backup file contains no data section.");
  for (const key of ["habits", "entries", "contextTags", "copingStrategies"]) {
    if (source[key] !== undefined && !Array.isArray(source[key])) {
      return fail(`The "${key}" section of the backup is damaged.`);
    }
  }

  const fallbackTime = isoOr(backup.exportedAt, nowIso());
  const addError = (message) => {
    if (errors.length < 10) errors.push(message);
  };

  // --- Habits ---
  const habits = [];
  (source.habits ?? []).forEach((habit, index) => {
    if (!isPlainObject(habit) || !isNonEmptyString(habit.id) || !isNonEmptyString(habit.name)) {
      addError(`Habit #${index + 1} is missing its ID or name.`);
      return;
    }
    const createdAt = isoOr(habit.createdAt, fallbackTime);
    habits.push({
      id: habit.id,
      name: cleanName(habit.name),
      description: typeof habit.description === "string" ? habit.description.trim() : "",
      icon: isNonEmptyString(habit.icon) ? habit.icon : DEFAULT_HABIT_ICON,
      accentColor: /^#[0-9a-f]{6}$/i.test(habit.accentColor ?? "") ? habit.accentColor.toLowerCase() : DEFAULT_HABIT_COLOR,
      isArchived: Boolean(habit.isArchived),
      createdAt,
      updatedAt: isoOr(habit.updatedAt, createdAt),
    });
  });

  // --- Tags and strategies (same shape) ---
  const readNamedList = (records, label) => {
    const items = [];
    (records ?? []).forEach((item, index) => {
      if (!isPlainObject(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
        addError(`${label} #${index + 1} is missing its ID or name.`);
        return;
      }
      const createdAt = isoOr(item.createdAt, fallbackTime);
      items.push({ id: item.id, name: cleanName(item.name), createdAt, updatedAt: isoOr(item.updatedAt, createdAt) });
    });
    return items;
  };
  const contextTags = readNamedList(source.contextTags, "Context tag");
  const copingStrategies = readNamedList(source.copingStrategies, "Coping strategy");

  // --- Entries ---
  const habitIds = new Set(habits.map((habit) => habit.id));
  const tagIds = new Set(contextTags.map((tag) => tag.id));
  const strategyIds = new Set(copingStrategies.map((strategy) => strategy.id));
  const validOutcomes = new Set(Object.values(OUTCOMES));
  const unknownEmotionIds = new Set();
  let droppedReferences = 0;

  const entries = [];
  (source.entries ?? []).forEach((entry, index) => {
    const where = `Entry #${index + 1}`;
    if (!isPlainObject(entry) || !isNonEmptyString(entry.id)) return addError(`${where} has no ID.`);
    if (!habitIds.has(entry.habitId)) return addError(`${where} refers to a habit that is not in the file.`);
    if (!isValidIsoTimestamp(entry.timestamp)) return addError(`${where} has no valid date and time.`);

    const emotionIds = Array.from(new Set(stringArray(entry.emotionIds)));
    if (emotionIds.length === 0) return addError(`${where} has no emotions.`);
    emotionIds.filter((id) => !isKnownEmotionId(id)).forEach((id) => unknownEmotionIds.add(id));

    let intensity = null;
    if (entry.intensity !== null && entry.intensity !== undefined) {
      if (!Number.isInteger(entry.intensity) || entry.intensity < 1 || entry.intensity > 10) {
        return addError(`${where} has an intensity outside 1–10.`);
      }
      intensity = entry.intensity;
    }

    const outcome = entry.outcome ?? null;
    if (outcome !== null && !validOutcomes.has(outcome)) return addError(`${where} has an unrecognised outcome.`);

    const keepKnown = (ids, known) => {
      const all = Array.from(new Set(stringArray(ids)));
      const kept = all.filter((id) => known.has(id));
      droppedReferences += all.length - kept.length;
      return kept;
    };

    const createdAt = isoOr(entry.createdAt, fallbackTime);
    entries.push({
      id: entry.id,
      habitId: entry.habitId,
      emotionIds,
      timestamp: new Date(entry.timestamp).toISOString(),
      intensity,
      situationalNotes: typeof entry.situationalNotes === "string" ? entry.situationalNotes : "",
      contextTagIds: keepKnown(entry.contextTagIds, tagIds),
      copingStrategyIds: keepKnown(entry.copingStrategyIds, strategyIds),
      outcome,
      outcomeUpdatedAt: outcome ? isoOr(entry.outcomeUpdatedAt, createdAt) : null,
      notes: typeof entry.notes === "string" ? entry.notes : "",
      reflectionPrompt: typeof entry.reflectionPrompt === "string" ? entry.reflectionPrompt : "",
      reflectionResponse: typeof entry.reflectionResponse === "string" ? entry.reflectionResponse : "",
      createdAt,
      updatedAt: isoOr(entry.updatedAt, createdAt),
    });
  });

  if (errors.length > 0) return { ok: false, errors, warnings };

  if (unknownEmotionIds.size > 0) {
    warnings.push(
      `${unknownEmotionIds.size} emotion ID${unknownEmotionIds.size === 1 ? "" : "s"} in the file ${unknownEmotionIds.size === 1 ? "is" : "are"} not on this version's emotion wheel. Those entries are kept and will show “Unknown emotion”.`,
    );
  }
  if (droppedReferences > 0) {
    warnings.push(`${droppedReferences} reference${droppedReferences === 1 ? "" : "s"} to tags or strategies missing from the file were ignored.`);
  }

  // --- Settings (only known, harmless keys; never the privacy PIN) ---
  const settings = {};
  if (isPlainObject(source.settings)) {
    const candidate = source.settings;
    if (["system", "light", "dark"].includes(candidate.theme)) settings.theme = candidate.theme;
    if (["day", "week"].includes(candidate.trendGranularity)) settings.trendGranularity = candidate.trendGranularity;
    if ([1, 3, 6].includes(candidate.timeBlockHours)) settings.timeBlockHours = candidate.timeBlockHours;
    for (const key of ["onboardingComplete", "reflectionPromptsEnabled", "logDetailsExpanded"]) {
      if (typeof candidate[key] === "boolean") settings[key] = candidate[key];
    }
  }

  return {
    ok: true,
    errors,
    warnings,
    data: {
      habits: dedupeById(habits, "habit", warnings),
      entries: dedupeById(entries, "entry", warnings),
      contextTags: dedupeById(contextTags, "tag", warnings),
      copingStrategies: dedupeById(copingStrategies, "strategy", warnings),
      settings,
    },
    meta: { exportedAt: isValidIsoTimestamp(backup.exportedAt) ? backup.exportedAt : null, formatVersion: raw.formatVersion },
  };
}

// ---------------------------------------------------------------------------
// Import step 3: work out what would change (pure – no database writes)
// ---------------------------------------------------------------------------

export const IMPORT_MODES = Object.freeze({ MERGE: "merge", REPLACE: "replace" });

/**
 * Compares validated backup data with the data currently on the device.
 *
 * MERGE (default, safest):
 *   - Records whose ID is not on the device are added.
 *   - Records whose ID IS on the device: the more recently updated copy wins.
 *   - A habit, tag or strategy with a new ID but the SAME NAME as an existing
 *     one is treated as that existing item (no duplicates); the imported
 *     entries are pointed at the existing item.
 *   - Nothing on the device is deleted.
 *
 * REPLACE: the device's data is erased and the file's data restored exactly.
 *
 * @param {object} incoming  `data` from validateBackup
 * @param {object} current   `{ habits, entries, contextTags, copingStrategies }` from the device
 */
export function buildImportPlan(incoming, current, mode = IMPORT_MODES.MERGE) {
  const entryTimes = incoming.entries.map((entry) => Date.parse(entry.timestamp));
  const dateRange = entryTimes.length
    ? { from: new Date(Math.min(...entryTimes)).toISOString(), to: new Date(Math.max(...entryTimes)).toISOString() }
    : null;

  if (mode === IMPORT_MODES.REPLACE) {
    const stat = (incomingList, currentList) => ({
      inFile: incomingList.length,
      added: incomingList.length,
      updated: 0,
      unchanged: 0,
      matchedByName: 0,
      removedFromDevice: currentList.length,
    });
    return {
      mode,
      dateRange,
      writes: {
        habits: incoming.habits,
        entries: incoming.entries,
        contextTags: incoming.contextTags,
        copingStrategies: incoming.copingStrategies,
      },
      settings: incoming.settings,
      stats: {
        habits: stat(incoming.habits, current.habits),
        entries: stat(incoming.entries, current.entries),
        contextTags: stat(incoming.contextTags, current.contextTags),
        copingStrategies: stat(incoming.copingStrategies, current.copingStrategies),
      },
      nameMatches: [],
    };
  }

  const nameMatches = [];

  /**
   * Plans one "named" collection (habits, tags or strategies).
   * Returns the records to write plus a map importedId → idToUseOnDevice.
   */
  const planNamed = (incomingList, currentList, kind, { updateIfNewer }) => {
    const currentById = new Map(currentList.map((item) => [item.id, item]));
    const currentByName = new Map(currentList.map((item) => [nameKey(item.name), item]));
    const idMap = new Map();
    const writes = [];
    const stats = { inFile: incomingList.length, added: 0, updated: 0, unchanged: 0, matchedByName: 0, removedFromDevice: 0 };

    for (const item of incomingList) {
      const sameId = currentById.get(item.id);
      if (sameId) {
        idMap.set(item.id, item.id);
        if (updateIfNewer && item.updatedAt > sameId.updatedAt) {
          writes.push(item);
          stats.updated += 1;
        } else {
          stats.unchanged += 1;
        }
        continue;
      }
      const sameName = currentByName.get(nameKey(item.name));
      if (sameName) {
        idMap.set(item.id, sameName.id);
        stats.matchedByName += 1;
        nameMatches.push({ kind, name: sameName.name });
        continue;
      }
      idMap.set(item.id, item.id);
      writes.push(item);
      stats.added += 1;
      // Guard against two new items in the same file sharing a name.
      currentByName.set(nameKey(item.name), item);
    }
    return { writes, idMap, stats };
  };

  const habitPlan = planNamed(incoming.habits, current.habits, "habit", { updateIfNewer: true });
  const tagPlan = planNamed(incoming.contextTags, current.contextTags, "tag", { updateIfNewer: false });
  const strategyPlan = planNamed(incoming.copingStrategies, current.copingStrategies, "strategy", { updateIfNewer: false });

  const remap = (ids, idMap) => Array.from(new Set(ids.map((id) => idMap.get(id) ?? id)));
  const currentEntriesById = new Map(current.entries.map((entry) => [entry.id, entry]));
  const entryWrites = [];
  const entryStats = { inFile: incoming.entries.length, added: 0, updated: 0, unchanged: 0, matchedByName: 0, removedFromDevice: 0 };

  for (const entry of incoming.entries) {
    const remapped = {
      ...entry,
      habitId: habitPlan.idMap.get(entry.habitId) ?? entry.habitId,
      contextTagIds: remap(entry.contextTagIds, tagPlan.idMap),
      copingStrategyIds: remap(entry.copingStrategyIds, strategyPlan.idMap),
    };
    const existing = currentEntriesById.get(entry.id);
    if (!existing) {
      entryWrites.push(remapped);
      entryStats.added += 1;
    } else if (entry.updatedAt > existing.updatedAt) {
      entryWrites.push(remapped);
      entryStats.updated += 1;
    } else {
      entryStats.unchanged += 1;
    }
  }

  return {
    mode,
    dateRange,
    writes: {
      habits: habitPlan.writes,
      entries: entryWrites,
      contextTags: tagPlan.writes,
      copingStrategies: strategyPlan.writes,
    },
    settings: null, // merging never changes this device's settings
    stats: {
      habits: habitPlan.stats,
      entries: entryStats,
      contextTags: tagPlan.stats,
      copingStrategies: strategyPlan.stats,
    },
    nameMatches,
  };
}

/** Reads the device's current data and builds the plan (the import preview). */
export async function previewImport(incoming, mode = IMPORT_MODES.MERGE) {
  const current = await readAllData();
  return buildImportPlan(incoming, current, mode);
}

// ---------------------------------------------------------------------------
// Import step 4: apply
// ---------------------------------------------------------------------------

/**
 * Writes an import plan to the database inside ONE transaction. If any write
 * fails, the transaction rolls back and the device's data is left exactly as
 * it was.
 */
export async function applyImportPlan(plan) {
  await db.transaction("rw", db.habits, db.entries, db.contextTags, db.copingStrategies, db.settings, async () => {
    if (plan.mode === IMPORT_MODES.REPLACE) {
      // Keep the privacy PIN (if any): it protects this device, not the data set.
      const lock = await db.settings.get("privacyLock");
      await Promise.all([
        db.habits.clear(),
        db.entries.clear(),
        db.contextTags.clear(),
        db.copingStrategies.clear(),
        db.settings.clear(),
      ]);
      const settingRows = Object.entries(plan.settings ?? {}).map(([key, value]) => ({ key, value }));
      if (lock) settingRows.push(lock);
      // The device clearly has been set up already, so skip onboarding.
      settingRows.push({ key: "onboardingComplete", value: true });
      await db.settings.bulkPut(settingRows);
    }
    await db.habits.bulkPut(plan.writes.habits);
    await db.contextTags.bulkPut(plan.writes.contextTags);
    await db.copingStrategies.bulkPut(plan.writes.copingStrategies);
    await db.entries.bulkPut(plan.writes.entries);
  });
  return plan.stats;
}

// ---------------------------------------------------------------------------
// CSV export (for spreadsheets)
// ---------------------------------------------------------------------------

/**
 * Makes one value safe for a CSV cell:
 *   - wraps it in quotes when it contains a comma, quote or line break
 *   - prefixes text starting with = + - @ with an apostrophe so spreadsheet
 *     programs treat a note like "-tired" as text, not as a formula.
 */
export function toCsvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Builds the CSV text: one row per entry, newest first.
 * lookups = { habitsById, tagsById, strategiesById } (Maps).
 */
export function entriesToCsv(entries, { habitsById, tagsById, strategiesById }) {
  const header = [
    "Date",
    "Time",
    "Timestamp (UTC)",
    "Habit",
    "Emotions",
    "Emotion categories",
    "Intensity (1-10)",
    "Outcome",
    "Outcome recorded at (UTC)",
    "Context tags",
    "Coping strategies",
    "What was happening",
    "Notes",
    "Reflection prompt",
    "Reflection",
  ];

  const names = (ids, byId) => (ids ?? []).map((id) => byId.get(id)?.name).filter(Boolean).join("; ");
  const twoDigits = (number) => String(number).padStart(2, "0");

  const rows = [...entries]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .map((entry) => {
      const local = toDate(entry.timestamp);
      return [
        toLocalDateKey(local),
        `${twoDigits(local.getHours())}:${twoDigits(local.getMinutes())}`,
        entry.timestamp,
        habitsById.get(entry.habitId)?.name ?? "Deleted habit",
        entry.emotionIds.map(getEmotionDisplayName).join("; "),
        getCategoryIdsForEmotions(entry.emotionIds).map((id) => getCategory(id).label).join("; "),
        entry.intensity ?? "",
        getOutcomeLabel(entry.outcome),
        entry.outcomeUpdatedAt ?? "",
        names(entry.contextTagIds, tagsById),
        names(entry.copingStrategyIds, strategiesById),
        entry.situationalNotes ?? "",
        entry.notes ?? "",
        entry.reflectionPrompt ?? "",
        entry.reflectionResponse ?? "",
      ];
    });

  // \r\n line endings are what the CSV standard (and Excel) expect.
  return [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\r\n");
}
