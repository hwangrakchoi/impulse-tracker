/**
 * EmotionPicker – choose one or more emotions from the wheel using cards.
 *
 * How it works for the user:
 *   1. Six large category cards (Anger, Disgust, Sad, Happy, Surprise, Fear).
 *   2. Tapping a category opens a panel with its secondary emotions.
 *        - "Just Sad" at the top quick-selects the category itself.
 *        - Tapping a secondary card (e.g. Lonely) selects it AND reveals its
 *          more specific tertiary emotions underneath.
 *        - The small arrow on a card reveals the tertiary emotions WITHOUT
 *          selecting the card – for when only "Empty" fits, not "Depressed".
 *   3. Everything selected appears as removable chips above the cards, and
 *      categories can be mixed freely in one entry.
 *
 * This is a "controlled" component: it does not own the selection. The parent
 * passes `selectedIds` and receives changes through `onChange(newIds)`. That
 * way the form that uses it always knows the current value.
 */
import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { PRIMARY_EMOTIONS, getChildEmotions, resolveEmotion } from "../../data/emotionTaxonomy.js";
import { getCategoryIcon } from "./categoryIcons.js";
import EmotionChip from "./EmotionChip.jsx";

export default function EmotionPicker({ selectedIds, onChange }) {
  // Which category panel is open, and which secondary cards show their children.
  // This is purely visual state, so it lives here rather than in the parent.
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const panelId = useId();

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  // How many selected emotions belong to each category (for the card badges).
  const selectedCountByCategory = useMemo(() => {
    const counts = new Map();
    for (const emotionId of selectedIds) {
      const { categoryId } = resolveEmotion(emotionId);
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }
    return counts;
  }, [selectedIds]);

  const toggleEmotion = (emotionId) => {
    onChange(selected.has(emotionId) ? selectedIds.filter((id) => id !== emotionId) : [...selectedIds, emotionId]);
  };

  const setExpanded = (emotionId, isExpanded) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (isExpanded) next.add(emotionId);
      else next.delete(emotionId);
      return next;
    });
  };

  const handleSecondaryToggle = (emotionId) => {
    // Selecting a secondary emotion also reveals its more specific options.
    if (!selected.has(emotionId)) setExpanded(emotionId, true);
    toggleEmotion(emotionId);
  };

  const openCategory = PRIMARY_EMOTIONS.find((category) => category.id === openCategoryId);

  return (
    <div className="emotion-picker">
      {/* --- Selected emotions --- */}
      <div className="emotion-picker__selected" aria-live="polite">
        {selectedIds.length === 0 ? (
          <p className="text-small text-muted">Nothing selected yet. Start with the closest category below.</p>
        ) : (
          <>
            <p className="visually-hidden">{selectedIds.length} selected:</p>
            <ul className="emotion-picker__chips" aria-label="Selected emotions">
              {selectedIds.map((emotionId) => (
                <li key={emotionId}>
                  <EmotionChip emotionId={emotionId} showCategory onRemove={toggleEmotion} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* --- Step 1: the six primary categories --- */}
      <div className={`emotion-primary-grid ${openCategory ? "emotion-primary-grid--compact" : ""}`}>
        {PRIMARY_EMOTIONS.map((category) => {
          const Icon = getCategoryIcon(category.id);
          const isOpen = category.id === openCategoryId;
          const count = selectedCountByCategory.get(category.id) ?? 0;
          return (
            <button
              key={category.id}
              type="button"
              className="emotion-primary-card"
              style={{ "--emotion-color": `var(${category.colorVar})` }}
              aria-expanded={isOpen}
              aria-controls={isOpen ? panelId : undefined}
              // Spoken name, e.g. "Sad, 2 selected" (the badge itself is decorative).
              aria-label={count > 0 ? `${category.label}, ${count} selected` : category.label}
              onClick={() => setOpenCategoryId(isOpen ? null : category.id)}
            >
              <Icon className="emotion-primary-card__icon" size={26} aria-hidden="true" />
              <span className="emotion-primary-card__label">{category.label}</span>
              {count > 0 ? (
                <span className="emotion-primary-card__count" aria-hidden="true">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* --- Steps 2 and 3: secondary and tertiary emotions of the open category --- */}
      {openCategory ? (
        <section
          id={panelId}
          className="emotion-panel"
          style={{ "--emotion-color": `var(${openCategory.colorVar})` }}
          aria-label={`${openCategory.label} emotions`}
        >
          <div className="emotion-panel__header">
            <h3>{openCategory.label}</h3>
            <button
              type="button"
              className="emotion-quick"
              aria-pressed={selected.has(openCategory.id)}
              onClick={() => toggleEmotion(openCategory.id)}
            >
              {selected.has(openCategory.id) ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              Just “{openCategory.label}”
            </button>
          </div>
          <p className="text-small text-secondary">
            Tap a word to select it. The arrow shows more specific words without selecting.
          </p>

          <ul className="emotion-secondary-grid">
            {getChildEmotions(openCategory.id).map((secondary) => {
              const tertiaryEmotions = getChildEmotions(secondary.id);
              const isSelected = selected.has(secondary.id);
              const isExpanded = expandedIds.has(secondary.id);
              const tertiaryListId = `${panelId}-${secondary.id}`;
              const selectedChildCount = tertiaryEmotions.filter((emotion) => selected.has(emotion.id)).length;
              return (
                <li key={secondary.id} className="emotion-card" data-selected={isSelected} data-expanded={isExpanded}>
                  {/* Tick badge in the corner: selection is shown by shape, not only by color. */}
                  {isSelected ? (
                    <span className="emotion-card__badge" aria-hidden="true">
                      <Check size={13} strokeWidth={3.5} />
                    </span>
                  ) : null}
                  <div className="emotion-card__row">
                    <button
                      type="button"
                      className="emotion-card__select"
                      aria-pressed={isSelected}
                      onClick={() => handleSecondaryToggle(secondary.id)}
                    >
                      <span>{secondary.label}</span>
                    </button>
                    {tertiaryEmotions.length > 0 ? (
                      <button
                        type="button"
                        className="emotion-card__expand"
                        aria-expanded={isExpanded}
                        aria-controls={isExpanded ? tertiaryListId : undefined}
                        aria-label={`More specific than ${secondary.label}`}
                        onClick={() => setExpanded(secondary.id, !isExpanded)}
                      >
                        {selectedChildCount > 0 && !isExpanded ? (
                          <span className="emotion-card__child-count" aria-hidden="true">
                            {selectedChildCount}
                          </span>
                        ) : null}
                        <ChevronDown size={18} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  {isExpanded ? (
                    <ul id={tertiaryListId} className="emotion-card__tertiary" aria-label={`More specific than ${secondary.label}`}>
                      {tertiaryEmotions.map((tertiary) => {
                        const isTertiarySelected = selected.has(tertiary.id);
                        return (
                          <li key={tertiary.id}>
                            <button
                              type="button"
                              className="emotion-tertiary"
                              aria-pressed={isTertiarySelected}
                              onClick={() => toggleEmotion(tertiary.id)}
                            >
                              <span className="emotion-check" aria-hidden="true">
                                {isTertiarySelected ? <Check size={14} strokeWidth={3} /> : null}
                              </span>
                              <span>{tertiary.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
