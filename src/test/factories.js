/**
 * Helpers for building test data. Used only by *.test.js files.
 */

let counter = 0;

/** A minimal in-memory entry (not saved anywhere) for pure-function tests. */
export function makeEntry(overrides = {}) {
  counter += 1;
  const timestamp = overrides.timestamp ?? new Date(2026, 10, 13, 18, 0).toISOString();
  return {
    id: `entry-${counter}`,
    habitId: "habit-alcohol",
    emotionIds: ["sad.lonely"],
    timestamp,
    intensity: null,
    situationalNotes: "",
    contextTagIds: [],
    copingStrategyIds: [],
    outcome: null,
    outcomeUpdatedAt: null,
    notes: "",
    reflectionPrompt: "",
    reflectionResponse: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function makeHabit(overrides = {}) {
  counter += 1;
  return {
    id: `habit-${counter}`,
    name: `Habit ${counter}`,
    description: "",
    icon: "circle-dot",
    accentColor: "#2f8f83",
    isArchived: false,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A local-time timestamp as an ISO string: at(2026, 11, 13, 17, 45). Month is 1–12. */
export function at(year, month, day, hour = 12, minute = 0) {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}
