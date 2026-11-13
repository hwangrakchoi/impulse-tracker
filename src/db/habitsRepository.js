/**
 * Habits repository
 * -----------------
 * A "repository" is a set of plain functions that read and write one kind of
 * record. The rest of the app calls these functions and never touches the
 * database directly.
 *
 * Every function is `async` because IndexedDB answers asynchronously –
 * callers use `await createHabit(...)`.
 */
import { db } from "./database.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from "../data/defaults.js";
import { isValidHabitIcon } from "../data/habitIcons.js";
import { createId } from "../utils/ids.js";
import { nowIso } from "../utils/dates.js";
import { cleanName, nameKey } from "../utils/text.js";

export const HABIT_NAME_MAX_LENGTH = 60;
export const HABIT_DESCRIPTION_MAX_LENGTH = 280;

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** Checks and tidies the editable fields of a habit. Throws ValidationError. */
async function normalizeHabitFields(fields, { ignoreHabitId = null } = {}) {
  const name = cleanName(fields.name);
  const fieldErrors = {};

  if (!name) {
    fieldErrors.name = "Give the habit a name.";
  } else if (name.length > HABIT_NAME_MAX_LENGTH) {
    fieldErrors.name = `Keep the name under ${HABIT_NAME_MAX_LENGTH} characters.`;
  } else {
    const allHabits = await db.habits.toArray();
    const clash = allHabits.find(
      (habit) => habit.id !== ignoreHabitId && nameKey(habit.name) === nameKey(name),
    );
    if (clash) {
      fieldErrors.name = clash.isArchived
        ? `"${clash.name}" already exists as an archived habit. Reactivate it instead.`
        : `You already have a habit called "${clash.name}".`;
    }
  }

  const description = String(fields.description ?? "").trim();
  if (description.length > HABIT_DESCRIPTION_MAX_LENGTH) {
    fieldErrors.description = `Keep the description under ${HABIT_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(Object.values(fieldErrors)[0], fieldErrors);
  }

  return {
    name,
    description,
    icon: isValidHabitIcon(fields.icon) ? fields.icon : DEFAULT_HABIT_ICON,
    accentColor: HEX_COLOR_PATTERN.test(fields.accentColor ?? "")
      ? fields.accentColor.toLowerCase()
      : DEFAULT_HABIT_COLOR,
  };
}

/** All habits (active and archived), oldest first. */
export async function listHabits() {
  return db.habits.orderBy("createdAt").toArray();
}

export async function getHabit(habitId) {
  return db.habits.get(habitId);
}

export async function createHabit(fields) {
  const normalized = await normalizeHabitFields(fields);
  const timestamp = nowIso();
  const habit = {
    id: createId(),
    ...normalized,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.habits.add(habit);
  return habit;
}

export async function updateHabit(habitId, fields) {
  const existing = await db.habits.get(habitId);
  if (!existing) throw new NotFoundError("That habit no longer exists.");
  const normalized = await normalizeHabitFields({ ...existing, ...fields }, { ignoreHabitId: habitId });
  const updated = { ...existing, ...normalized, updatedAt: nowIso() };
  await db.habits.put(updated);
  return updated;
}

/**
 * Archiving hides a habit from the "Log an urge" screen but keeps the habit
 * and all of its entries, so history and analytics stay complete.
 */
export async function setHabitArchived(habitId, isArchived) {
  const changed = await db.habits.update(habitId, { isArchived: Boolean(isArchived), updatedAt: nowIso() });
  if (changed === 0) throw new NotFoundError("That habit no longer exists.");
  return db.habits.get(habitId);
}

export async function countEntriesForHabit(habitId) {
  return db.entries.where("habitId").equals(habitId).count();
}

/**
 * Permanently deletes a habit AND every entry logged for it.
 *
 * Both deletions run inside one transaction: either everything is removed or
 * – if something fails halfway – nothing is, so no orphaned entries remain.
 */
export async function deleteHabit(habitId) {
  return db.transaction("rw", db.habits, db.entries, async () => {
    const deletedEntryCount = await db.entries.where("habitId").equals(habitId).delete();
    await db.habits.delete(habitId);
    return { deletedEntryCount };
  });
}
