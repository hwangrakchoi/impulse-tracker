import { X } from "lucide-react";
import { EMOTION_LEVELS, getCategory, getEmotionDisplayName, resolveEmotion } from "../../data/emotionTaxonomy.js";

/**
 * A small pill showing one emotion in its category color.
 *
 * Props:
 *   emotionId     ID from the taxonomy
 *   showCategory  also print the category name ("Lonely · Sad"), so the
 *                 category is never conveyed by color alone
 *   onRemove      when given, the chip gets an ✕ button
 */
export default function EmotionChip({ emotionId, showCategory = false, onRemove }) {
  const emotion = resolveEmotion(emotionId);
  const name = getEmotionDisplayName(emotionId);
  const categoryLabel = getCategory(emotion.categoryId)?.label;
  const shouldPrintCategory = showCategory && categoryLabel && emotion.level !== EMOTION_LEVELS.PRIMARY;

  return (
    <span className="emotion-chip" style={{ "--emotion-color": `var(${emotion.colorVar})` }}>
      <span className="emotion-chip__dot" aria-hidden="true" />
      <span className="emotion-chip__label">{name}</span>
      {shouldPrintCategory ? <span className="emotion-chip__category">{categoryLabel}</span> : null}
      {onRemove ? (
        <button type="button" className="emotion-chip__remove" onClick={() => onRemove(emotionId)} aria-label={`Remove ${name}`}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
