/**
 * Emotion taxonomy
 * ================
 * The single source of truth for every emotion the app knows about. React
 * components never hard-code emotion names – they import from this file.
 *
 * The wheel has three levels:
 *   level 1 – six primary categories (Anger, Disgust, Sad, Happy, Surprise, Fear)
 *   level 2 – secondary emotions (e.g. Sad → Lonely)
 *   level 3 – tertiary emotions  (e.g. Sad → Lonely → Isolated)
 *
 * ⚠️  REVIEW NEEDED – tertiary level not yet checked against your wheel image
 * -------------------------------------------------------------------------
 * The primary and secondary levels below are exactly the transcription from
 * the project brief. The wheel IMAGE itself was not available in the workspace
 * when this file was written, so the tertiary (outer-ring) labels come from
 * the widely published six-category wheel whose inner two rings match the
 * brief exactly. They could not be verified against your copy.
 * `TERTIARY_LEVEL_VERIFIED` stays `false` until someone compares this file
 * with the image; Settings → About shows that status.
 *
 * IDs are stable and never shown to the user
 * ------------------------------------------
 * Log entries store emotion IDs such as "sad.lonely.isolated", not labels.
 * That gives two guarantees:
 *   1. Labels that appear more than once on the wheel stay distinct
 *      ("fear.insecure.inadequate" vs "fear.rejected.inadequate").
 *   2. A label can be re-worded later without breaking old entries.
 * To correct a label: change `label` only. To remove an emotion: do NOT delete
 * its line (old entries still point at it) – add `retired: true` so it leaves
 * the picker but still displays in History.
 */

/** Bump when emotions are added, retired or re-parented. Stored in backups. */
export const TAXONOMY_VERSION = 1;

/** See the review note at the top of this file. */
export const TERTIARY_LEVEL_VERIFIED = false;

export const EMOTION_LEVELS = Object.freeze({ PRIMARY: 1, SECONDARY: 2, TERTIARY: 3 });

/** Shorthand used only to keep the table below readable: [idSlug, label]. */
const secondary = (slug, label, tertiary) => ({ slug, label, tertiary });

/**
 * The wheel, written as a tree. Order follows the wheel (clockwise within
 * each category) and is the order used by the picker.
 *
 * `color` is the light-theme color and `colorDark` the dark-theme one; the
 * same values live in src/styles/tokens.css as `--emotion-<id>`.
 */
const WHEEL = [
  {
    slug: "anger",
    label: "Anger",
    colorName: "Red",
    color: "#e34948",
    colorDark: "#e5595c",
    secondary: [
      secondary("hurt", "Hurt", [["embarrassed", "Embarrassed"], ["devastated", "Devastated"]]),
      secondary("threatened", "Threatened", [["insecure", "Insecure"], ["jealous", "Jealous"]]),
      secondary("hateful", "Hateful", [["resentful", "Resentful"], ["violated", "Violated"]]),
      secondary("mad", "Mad", [["furious", "Furious"], ["enraged", "Enraged"]]),
      secondary("aggressive", "Aggressive", [["provoked", "Provoked"], ["hostile", "Hostile"]]),
      secondary("frustrated", "Frustrated", [["infuriated", "Infuriated"], ["irritated", "Irritated"]]),
      secondary("distant", "Distant", [["withdrawn", "Withdrawn"], ["suspicious", "Suspicious"]]),
      secondary("critical", "Critical", [["skeptical", "Skeptical"], ["sarcastic", "Sarcastic"]]),
    ],
  },
  {
    slug: "disgust",
    label: "Disgust",
    colorName: "Purple",
    color: "#8b6fd9",
    colorDark: "#9085e9",
    secondary: [
      secondary("disapproval", "Disapproval", [["judgmental", "Judgmental"], ["loathing", "Loathing"]]),
      secondary("disappointed", "Disappointed", [["repugnant", "Repugnant"], ["revolted", "Revolted"]]),
      secondary("awful", "Awful", [["revulsion", "Revulsion"], ["detestable", "Detestable"]]),
      secondary("avoidance", "Avoidance", [["aversion", "Aversion"], ["hesitant", "Hesitant"]]),
    ],
  },
  {
    slug: "sad",
    label: "Sad",
    colorName: "Blue",
    color: "#2a78d6",
    colorDark: "#3987e5",
    secondary: [
      secondary("guilty", "Guilty", [["remorseful", "Remorseful"], ["ashamed", "Ashamed"]]),
      secondary("abandoned", "Abandoned", [["ignored", "Ignored"], ["victimized", "Victimized"]]),
      secondary("despair", "Despair", [["powerless", "Powerless"], ["vulnerable", "Vulnerable"]]),
      secondary("depressed", "Depressed", [["inferior", "Inferior"], ["empty", "Empty"]]),
      secondary("lonely", "Lonely", [["abandoned", "Abandoned"], ["isolated", "Isolated"]]),
      secondary("bored", "Bored", [["apathetic", "Apathetic"], ["indifferent", "Indifferent"]]),
    ],
  },
  {
    slug: "happy",
    label: "Happy",
    colorName: "Yellow",
    color: "#eda100",
    colorDark: "#c98500",
    secondary: [
      secondary("optimistic", "Optimistic", [["inspired", "Inspired"], ["open", "Open"]]),
      secondary("intimate", "Intimate", [["playful", "Playful"], ["sensitive", "Sensitive"]]),
      secondary("peaceful", "Peaceful", [["hopeful", "Hopeful"], ["loving", "Loving"]]),
      secondary("powerful", "Powerful", [["provocative", "Provocative"], ["courageous", "Courageous"]]),
      secondary("accepted", "Accepted", [["fulfilled", "Fulfilled"], ["respected", "Respected"]]),
      secondary("proud", "Proud", [["confident", "Confident"], ["important", "Important"]]),
      secondary("interested", "Interested", [["inquisitive", "Inquisitive"], ["amused", "Amused"]]),
      secondary("joyful", "Joyful", [["ecstatic", "Ecstatic"], ["liberating", "Liberating"]]),
    ],
  },
  {
    slug: "surprise",
    label: "Surprise",
    colorName: "Cyan",
    color: "#12a8c8",
    colorDark: "#18a4be",
    secondary: [
      secondary("startled", "Startled", [["shocked", "Shocked"], ["dismayed", "Dismayed"]]),
      secondary("confused", "Confused", [["disillusioned", "Disillusioned"], ["perplexed", "Perplexed"]]),
      secondary("amazed", "Amazed", [["astonished", "Astonished"], ["awe", "Awe"]]),
      secondary("excited", "Excited", [["eager", "Eager"], ["energetic", "Energetic"]]),
    ],
  },
  {
    slug: "fear",
    label: "Fear",
    colorName: "Green",
    color: "#008300",
    colorDark: "#008300",
    secondary: [
      secondary("scared", "Scared", [["frightened", "Frightened"], ["terrified", "Terrified"]]),
      secondary("anxious", "Anxious", [["overwhelmed", "Overwhelmed"], ["worried", "Worried"]]),
      secondary("insecure", "Insecure", [["inadequate", "Inadequate"], ["inferior", "Inferior"]]),
      secondary("submissive", "Submissive", [["worthless", "Worthless"], ["insignificant", "Insignificant"]]),
      secondary("rejected", "Rejected", [["inadequate", "Inadequate"], ["alienated", "Alienated"]]),
      secondary("humiliated", "Humiliated", [["disrespected", "Disrespected"], ["ridiculed", "Ridiculed"]]),
    ],
  },
];

/**
 * Turns the tree above into a flat list where every emotion is one object:
 *   { id, label, level, categoryId, secondaryId, parentId, color, colorDark,
 *     colorVar, colorName, retired }
 *
 * - categoryId  → the primary category the emotion belongs to
 * - secondaryId → its secondary emotion (null for primaries; a secondary
 *                 emotion points at itself)
 * - parentId    → the emotion one level up (null for primaries)
 */
function flattenWheel(wheel) {
  const flat = [];
  for (const category of wheel) {
    const shared = {
      categoryId: category.slug,
      color: category.color,
      colorDark: category.colorDark,
      colorVar: `--emotion-${category.slug}`,
      colorName: category.colorName,
      retired: false,
    };
    flat.push({
      ...shared,
      id: category.slug,
      label: category.label,
      level: EMOTION_LEVELS.PRIMARY,
      secondaryId: null,
      parentId: null,
    });
    for (const second of category.secondary) {
      const secondaryId = `${category.slug}.${second.slug}`;
      flat.push({
        ...shared,
        id: secondaryId,
        label: second.label,
        level: EMOTION_LEVELS.SECONDARY,
        secondaryId,
        parentId: category.slug,
        retired: Boolean(second.retired),
      });
      for (const [slug, label, options] of second.tertiary) {
        flat.push({
          ...shared,
          id: `${secondaryId}.${slug}`,
          label,
          level: EMOTION_LEVELS.TERTIARY,
          secondaryId,
          parentId: secondaryId,
          retired: Boolean(options?.retired),
        });
      }
    }
  }
  return flat.map((emotion) => Object.freeze(emotion));
}

/** Every emotion on the wheel as a flat, read-only list. */
export const EMOTIONS = Object.freeze(flattenWheel(WHEEL));

const emotionsById = new Map(EMOTIONS.map((emotion) => [emotion.id, emotion]));

// How many times each label appears, so duplicates can be disambiguated.
const labelCounts = new Map();
for (const emotion of EMOTIONS) {
  labelCounts.set(emotion.label, (labelCounts.get(emotion.label) ?? 0) + 1);
}

/** The six primary categories, in wheel order. */
export const PRIMARY_EMOTIONS = Object.freeze(
  EMOTIONS.filter((emotion) => emotion.level === EMOTION_LEVELS.PRIMARY),
);

export const CATEGORY_IDS = Object.freeze(PRIMARY_EMOTIONS.map((emotion) => emotion.id));

/**
 * Order used when categories sit next to each other in a chart (donut slices,
 * stacked bar segments). Chosen so that neighbouring colors stay easy to tell
 * apart for people with red-green color blindness – e.g. blue and purple, or
 * red and green, are never adjacent.
 */
export const CHART_CATEGORY_ORDER = Object.freeze([
  "anger",
  "disgust",
  "happy",
  "surprise",
  "fear",
  "sad",
]);

/** Placeholder shown when an entry refers to an ID this version doesn't know. */
const UNKNOWN_EMOTION = Object.freeze({
  label: "Unknown emotion",
  level: null,
  categoryId: null,
  secondaryId: null,
  parentId: null,
  color: "#8a8791",
  colorDark: "#8a8791",
  colorVar: "--emotion-unknown",
  colorName: "Grey",
  retired: true,
  isUnknown: true,
});

export function isKnownEmotionId(emotionId) {
  return emotionsById.has(emotionId);
}

/** Returns the emotion, or `undefined` if the ID is not in the taxonomy. */
export function getEmotion(emotionId) {
  return emotionsById.get(emotionId);
}

/** Like getEmotion, but never returns undefined – handy when rendering. */
export function resolveEmotion(emotionId) {
  return emotionsById.get(emotionId) ?? { ...UNKNOWN_EMOTION, id: emotionId };
}

/** The primary category object for a category ID (e.g. "sad"). */
export function getCategory(categoryId) {
  const emotion = emotionsById.get(categoryId);
  return emotion?.level === EMOTION_LEVELS.PRIMARY ? emotion : undefined;
}

/** Direct children of an emotion, in wheel order. Retired ones are skipped. */
export function getChildEmotions(parentId, { includeRetired = false } = {}) {
  return EMOTIONS.filter(
    (emotion) => emotion.parentId === parentId && (includeRetired || !emotion.retired),
  );
}

/**
 * The name to show for an emotion. Labels that occur more than once on the
 * wheel get their parent in brackets – "Inadequate (Rejected)" – so two
 * different emotions never look identical in a list or chart.
 */
export function getEmotionDisplayName(emotionId) {
  const emotion = emotionsById.get(emotionId);
  if (!emotion) return UNKNOWN_EMOTION.label;
  const isDuplicateLabel = (labelCounts.get(emotion.label) ?? 0) > 1;
  if (!isDuplicateLabel || !emotion.parentId) return emotion.label;
  return `${emotion.label} (${emotionsById.get(emotion.parentId).label})`;
}

/** e.g. "Sad › Lonely › Isolated" – used for accessible descriptions. */
export function getEmotionPathLabel(emotionId) {
  const labels = [];
  let current = emotionsById.get(emotionId);
  while (current) {
    labels.unshift(current.label);
    current = current.parentId ? emotionsById.get(current.parentId) : undefined;
  }
  return labels.length > 0 ? labels.join(" › ") : UNKNOWN_EMOTION.label;
}

/**
 * The distinct primary categories touched by a list of emotion IDs, in wheel
 * order. Three "Sad" emotions and one "Fear" emotion → ["sad", "fear"].
 * Unknown IDs are ignored.
 */
export function getCategoryIdsForEmotions(emotionIds = []) {
  const found = new Set();
  for (const emotionId of emotionIds) {
    const emotion = emotionsById.get(emotionId);
    if (emotion) found.add(emotion.categoryId);
  }
  return CATEGORY_IDS.filter((categoryId) => found.has(categoryId));
}

/**
 * A compact copy of the taxonomy for backup files, so an exported file can be
 * understood on its own (and by future versions with a different wheel).
 */
export function getEmotionReferenceList() {
  return EMOTIONS.map(({ id, label, level, categoryId, parentId }) => ({
    id,
    label,
    level,
    categoryId,
    parentId,
  }));
}
