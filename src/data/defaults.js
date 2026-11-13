/**
 * Built-in lists: starter tags, coping strategies, outcome options, etc.
 *
 * These are plain data. Tags and coping strategies are copied into the
 * database the first time the app runs (see src/db/database.js) – after that
 * the user owns them and can rename, add or delete freely.
 */

/** Starter context tags. The fixed IDs let backups merge without duplicates. */
export const DEFAULT_CONTEXT_TAGS = [
  { id: "tag-alone", name: "Alone" },
  { id: "tag-with-friends", name: "With friends" },
  { id: "tag-at-work", name: "At work" },
  { id: "tag-at-home", name: "At home" },
  { id: "tag-social-situation", name: "Social situation" },
  { id: "tag-bored", name: "Bored" },
  { id: "tag-stressed", name: "Stressed" },
  { id: "tag-tired", name: "Tired" },
  { id: "tag-after-conflict", name: "After conflict" },
  { id: "tag-before-bed", name: "Before bed" },
];

/** Starter coping strategies. Users add their own ("custom strategy"). */
export const DEFAULT_COPING_STRATEGIES = [
  { id: "strategy-exercise", name: "Exercise" },
  { id: "strategy-reading", name: "Reading" },
  { id: "strategy-meditation", name: "Meditation" },
  { id: "strategy-calling-someone", name: "Calling someone" },
  { id: "strategy-going-for-a-walk", name: "Going for a walk" },
  { id: "strategy-journaling", name: "Journaling" },
  { id: "strategy-breathing-exercise", name: "Breathing exercise" },
  { id: "strategy-waiting-out-the-urge", name: "Waiting out the urge" },
];

/**
 * What happened after the urge. The wording is deliberately neutral – the app
 * observes, it does not grade. "Not recorded" is stored as `null`.
 */
export const OUTCOMES = Object.freeze({
  PASSED: "passed",
  ENGAGED: "engaged",
  ONGOING: "ongoing",
});

export const OUTCOME_OPTIONS = [
  {
    value: OUTCOMES.PASSED,
    label: "Urge passed",
    description: "It passed without engaging in the habit.",
  },
  {
    value: OUTCOMES.ENGAGED,
    label: "Engaged",
    description: "I engaged in the habit.",
  },
  {
    value: OUTCOMES.ONGOING,
    label: "Still ongoing",
    description: "The urge is still here. I can update this later.",
  },
  {
    value: null,
    label: "Not recorded",
    description: "Leave the outcome blank.",
  },
];

/** Value used by filters to mean "entries with no outcome recorded". */
export const OUTCOME_FILTER_NONE = "none";

export function getOutcomeLabel(outcome) {
  return OUTCOME_OPTIONS.find((option) => option.value === (outcome ?? null))?.label ?? "Not recorded";
}

/** Optional prompts offered after saving an urge. Always skippable. */
export const REFLECTION_PROMPTS = [
  "What do I need right now?",
  "What happened immediately before this feeling?",
  "Is there something I can do for the next ten minutes?",
  "What has helped me in a similar situation?",
];

/** Accent colors offered in the habit form (any custom color is also allowed). */
export const HABIT_COLOR_CHOICES = [
  { value: "#c0563f", name: "Terracotta" },
  { value: "#d98a2b", name: "Amber" },
  { value: "#7a8f3c", name: "Olive" },
  { value: "#2f8f83", name: "Teal" },
  { value: "#3f7cc0", name: "Blue" },
  { value: "#6a5bc4", name: "Indigo" },
  { value: "#a8559f", name: "Plum" },
  { value: "#c74d7b", name: "Rose" },
  { value: "#6b7280", name: "Slate" },
];

export const DEFAULT_HABIT_COLOR = HABIT_COLOR_CHOICES[3].value;
export const DEFAULT_HABIT_ICON = "circle-dot";

/**
 * Examples shown during onboarding. They are only suggestions – nothing is
 * created unless the user taps one.
 */
export const HABIT_SUGGESTIONS = [
  { name: "Alcohol", icon: "wine", accentColor: "#a8559f" },
  { name: "Vaping", icon: "cloud", accentColor: "#2f8f83" },
  { name: "Pornography", icon: "eye-off", accentColor: "#6a5bc4" },
  { name: "Social media", icon: "smartphone", accentColor: "#3f7cc0" },
  { name: "Gambling", icon: "dices", accentColor: "#c0563f" },
  { name: "Impulsive shopping", icon: "shopping-bag", accentColor: "#c74d7b" },
  { name: "Overeating", icon: "cookie", accentColor: "#d98a2b" },
];

/** Default values for everything stored in the `settings` table. */
export const DEFAULT_SETTINGS = Object.freeze({
  theme: "system", // "system" | "light" | "dark"
  onboardingComplete: false,
  reflectionPromptsEnabled: true,
  logDetailsExpanded: false, // remember whether the optional section is open
  trendGranularity: "day", // "day" | "week"
  timeBlockHours: 3, // 1 | 3 | 6
  privacyLock: null, // { salt, hash, iterations } when a PIN is set
});
