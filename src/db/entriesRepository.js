/**
 * Entries repository – "trigger entries", i.e. logged urges.
 *
 * An entry looks like this:
 * {
 *   id: "2f1c…",                         stable unique ID
 *   habitId: "…",                        which habit the urge was about
 *   emotionIds: ["sad.lonely", …],       IDs from the emotion taxonomy
 *   timestamp: "2026-11-14T01:45:00.000Z" when the urge happened (UTC)
 *   intensity: 8 | null,                 1–10, optional
 *   situationalNotes: "",                "What was happening?"
 *   contextTagIds: [],                   optional tags
 *   copingStrategyIds: [],               optional strategies tried
 *   outcome: "passed" | "engaged" | "ongoing" | null,
 *   outcomeUpdatedAt: "…" | null,        when the outcome was last set
 *   notes: "",                           free-form notes
 *   reflectionPrompt / reflectionResponse  optional post-log reflection
 *   createdAt, updatedAt                 bookkeeping timestamps
 * }
 */
import { db } from "./database.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { OUTCOMES } from "../data/defaults.js";
import { createId } from "../utils/ids.js";
import { isValidIsoTimestamp, nowIso } from "../utils/dates.js";

export const TEXT_FIELD_MAX_LENGTH = 4000;
export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 10;

const VALID_OUTCOMES = new Set(Object.values(OUTCOMES));

const uniqueStrings = (values) =>
  Array.from(new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value)));

const cleanText = (value) => String(value ?? "").trim().slice(0, TEXT_FIELD_MAX_LENGTH);

/**
 * Checks the user-editable fields of an entry and returns a tidy copy.
 * Throws a ValidationError listing every problem, keyed by field name.
 */
export function normalizeEntryFields(fields) {
  const fieldErrors = {};

  if (!fields.habitId || typeof fields.habitId !== "string") {
    fieldErrors.habitId = "Choose which habit this urge was about.";
  }

  const emotionIds = uniqueStrings(fields.emotionIds);
  if (emotionIds.length === 0) {
    fieldErrors.emotionIds = "Choose at least one emotion.";
  }

  if (!isValidIsoTimestamp(fields.timestamp)) {
    fieldErrors.timestamp = "Enter a valid date and time.";
  } else if (Date.parse(fields.timestamp) > Date.now() + 5 * 60 * 1000) {
    fieldErrors.timestamp = "The date and time can't be in the future.";
  }

  let intensity = null;
  if (fields.intensity !== null && fields.intensity !== undefined && fields.intensity !== "") {
    intensity = Number(fields.intensity);
    if (!Number.isInteger(intensity) || intensity < INTENSITY_MIN || intensity > INTENSITY_MAX) {
      fieldErrors.intensity = `Intensity must be a whole number from ${INTENSITY_MIN} to ${INTENSITY_MAX}.`;
    }
  }

  const outcome = fields.outcome ?? null;
  if (outcome !== null && !VALID_OUTCOMES.has(outcome)) {
    fieldErrors.outcome = "Choose one of the listed outcomes.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(Object.values(fieldErrors)[0], fieldErrors);
  }

  return {
    habitId: fields.habitId,
    emotionIds,
    timestamp: new Date(fields.timestamp).toISOString(),
    intensity,
    situationalNotes: cleanText(fields.situationalNotes),
    contextTagIds: uniqueStrings(fields.contextTagIds),
    copingStrategyIds: uniqueStrings(fields.copingStrategyIds),
    outcome,
    notes: cleanText(fields.notes),
    reflectionPrompt: cleanText(fields.reflectionPrompt),
    reflectionResponse: cleanText(fields.reflectionResponse),
  };
}

/** Every entry, newest urge first. */
export async function listEntries() {
  return db.entries.orderBy("timestamp").reverse().toArray();
}

export async function getEntry(entryId) {
  return db.entries.get(entryId);
}

export async function createEntry(fields) {
  const normalized = normalizeEntryFields(fields);

  const habit = await db.habits.get(normalized.habitId);
  if (!habit) {
    throw new ValidationError("That habit no longer exists.", {
      habitId: "That habit no longer exists. Choose another one.",
    });
  }

  const timestamp = nowIso();
  const entry = {
    id: createId(),
    ...normalized,
    // The moment the outcome was recorded (null while there is none).
    outcomeUpdatedAt: normalized.outcome ? timestamp : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.entries.add(entry);
  return entry;
}

/**
 * Updates an entry. Pass only the fields that change.
 * `createdAt` is never altered, and the urge's own `timestamp` only changes
 * if a new one is passed explicitly.
 */
export async function updateEntry(entryId, changes) {
  const existing = await db.entries.get(entryId);
  if (!existing) throw new NotFoundError("That entry no longer exists.");

  const normalized = normalizeEntryFields({ ...existing, ...changes });
  const timestamp = nowIso();
  const outcomeChanged = normalized.outcome !== (existing.outcome ?? null);

  const updated = {
    ...existing,
    ...normalized,
    outcomeUpdatedAt: outcomeChanged
      ? normalized.outcome
        ? timestamp
        : null
      : (existing.outcomeUpdatedAt ?? null),
    updatedAt: timestamp,
  };
  await db.entries.put(updated);
  return updated;
}

/**
 * Follow-up for an urge saved as "still ongoing": records what happened
 * without touching the original urge timestamp.
 */
export async function updateEntryOutcome(entryId, outcome) {
  return updateEntry(entryId, { outcome });
}

export async function deleteEntry(entryId) {
  await db.entries.delete(entryId);
}
