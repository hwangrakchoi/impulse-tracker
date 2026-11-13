import { useId } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { OUTCOME_FILTER_NONE, OUTCOME_OPTIONS } from "../../data/defaults.js";
import { EMOTIONS, EMOTION_LEVELS, PRIMARY_EMOTIONS, getEmotionDisplayName } from "../../data/emotionTaxonomy.js";
import { useToday } from "../../hooks/useToday.js";
import { toLocalDateKey } from "../../utils/dates.js";
import { pluralize } from "../../utils/text.js";
import { EMPTY_FILTERS } from "./historyFilters.js";

const INTENSITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * The filter panel for History. Changes apply immediately (the list behind
 * the sheet updates), so the main button simply closes the sheet.
 *
 * Plain <select> menus are fine here: this is filtering, not the emotion
 * check-in itself (which uses the card picker).
 */
export default function HistoryFilterSheet({ isOpen, onClose, filters, onChange, habits, resultCount }) {
  const id = useId();
  const set = (changes) => onChange({ ...filters, ...changes });
  const today = toLocalDateKey(useToday());

  // When a category is chosen, the emotion menu only lists that category.
  const emotionGroups = PRIMARY_EMOTIONS.filter((category) => !filters.categoryId || category.id === filters.categoryId).map(
    (category) => ({
      category,
      emotions: EMOTIONS.filter((emotion) => emotion.categoryId === category.id && !emotion.retired),
    }),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter history"
      footer={
        <>
          <button type="button" className="btn btn--primary" onClick={onClose} data-autofocus>
            Show {pluralize(resultCount, "entry", "entries")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onChange({ ...EMPTY_FILTERS })}>
            Clear all filters
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor={`${id}-habit`}>
            Habit
          </label>
          <select id={`${id}-habit`} className="select" value={filters.habitId} onChange={(event) => set({ habitId: event.target.value })}>
            <option value="">All habits</option>
            {habits.map((habit) => (
              <option key={habit.id} value={habit.id}>
                {habit.name}
                {habit.isArchived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="field">
          <legend className="field__label">Date range</legend>
          <div className="filter-pair">
            <div className="field">
              <label className="field__hint" htmlFor={`${id}-from`}>
                From
              </label>
              <input
                id={`${id}-from`}
                className="input"
                type="date"
                value={filters.fromDate}
                max={filters.toDate || today}
                onChange={(event) => set({ fromDate: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__hint" htmlFor={`${id}-to`}>
                To
              </label>
              <input
                id={`${id}-to`}
                className="input"
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                max={today}
                onChange={(event) => set({ toDate: event.target.value })}
              />
            </div>
          </div>
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-category`}>
            Emotion category
          </label>
          <select
            id={`${id}-category`}
            className="select"
            value={filters.categoryId}
            // Changing the category clears a specific emotion from another category.
            onChange={(event) => set({ categoryId: event.target.value, emotionId: "" })}
          >
            <option value="">Any category</option>
            {PRIMARY_EMOTIONS.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-emotion`}>
            Specific emotion
          </label>
          <select id={`${id}-emotion`} className="select" value={filters.emotionId} onChange={(event) => set({ emotionId: event.target.value })}>
            <option value="">Any emotion</option>
            {emotionGroups.map(({ category, emotions }) => (
              <optgroup key={category.id} label={category.label}>
                {emotions.map((emotion) => (
                  <option key={emotion.id} value={emotion.id}>
                    {emotion.level === EMOTION_LEVELS.TERTIARY ? "   " : ""}
                    {getEmotionDisplayName(emotion.id)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <fieldset className="field">
          <legend className="field__label">Urge intensity</legend>
          <div className="filter-pair">
            <div className="field">
              <label className="field__hint" htmlFor={`${id}-min`}>
                At least
              </label>
              <select id={`${id}-min`} className="select" value={filters.intensityMin} onChange={(event) => set({ intensityMin: event.target.value })}>
                <option value="">Any</option>
                {INTENSITY_LEVELS.filter((level) => filters.intensityMax === "" || level <= Number(filters.intensityMax)).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__hint" htmlFor={`${id}-max`}>
                At most
              </label>
              <select id={`${id}-max`} className="select" value={filters.intensityMax} onChange={(event) => set({ intensityMax: event.target.value })}>
                <option value="">Any</option>
                {INTENSITY_LEVELS.filter((level) => filters.intensityMin === "" || level >= Number(filters.intensityMin)).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="field__hint">Entries without a recorded intensity are left out when this is set.</p>
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-outcome`}>
            Outcome
          </label>
          <select id={`${id}-outcome`} className="select" value={filters.outcome} onChange={(event) => set({ outcome: event.target.value })}>
            <option value="">Any outcome</option>
            {OUTCOME_OPTIONS.map((option) => (
              <option key={String(option.value)} value={option.value ?? OUTCOME_FILTER_NONE}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
