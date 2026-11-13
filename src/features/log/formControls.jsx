/**
 * The individual inputs used by the Log Urge form. Each one is a small
 * "controlled" component: it shows the `value` it is given and reports
 * changes through `onChange`, while EntryForm owns the actual state.
 */
import { useId, useState } from "react";
import { Check, Clock, Plus, X } from "lucide-react";
import { ChoiceChip } from "../../components/ui/controls.jsx";
import { HabitIcon } from "../../components/ui/display.jsx";
import { OUTCOME_OPTIONS } from "../../data/defaults.js";
import { describeError } from "../../db/errors.js";
import { INTENSITY_MAX, INTENSITY_MIN } from "../../db/entriesRepository.js";
import { NAMED_ITEM_MAX_LENGTH } from "../../db/namedListRepository.js";
import { useToday } from "../../hooks/useToday.js";
import { formatDateTime, toLocalDateKey, toLocalInputValue } from "../../utils/dates.js";

/** Radio cards for choosing the habit. */
export function HabitPicker({ habits, value, onChange, describedBy }) {
  const name = useId();
  return (
    <div className="habit-option-grid" role="radiogroup" aria-label="Habit" aria-describedby={describedBy}>
      {habits.map((habit) => (
        <label key={habit.id} className="habit-option">
          <input type="radio" name={name} checked={value === habit.id} onChange={() => onChange(habit.id)} />
          <span className="habit-option__face">
            <HabitIcon habit={habit} size="sm" />
            <span className="habit-option__name">
              {habit.name}
              {habit.isArchived ? <span className="text-xs text-muted"> (archived)</span> : null}
            </span>
            <Check className="habit-option__check" size={18} aria-hidden="true" />
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * "Now" by default; "Change" reveals a date-and-time input for logging
 * something that happened earlier.
 *
 * value = { useCurrentTime: boolean, inputValue: "2026-11-13T17:45" }
 */
export function TimestampField({ value, onChange, errorId, hasError }) {
  const inputId = useId();
  // Latest selectable moment: the end of today. (Saving re-checks that the
  // time is not in the future.)
  const latestAllowed = `${toLocalDateKey(useToday())}T23:59`;

  if (value.useCurrentTime) {
    return (
      <div className="timestamp-now">
        <Clock size={20} className="text-muted" aria-hidden="true" />
        <span className="grow">
          <span className="text-strong">Now</span>
          <span className="text-small text-muted"> · saved automatically</span>
        </span>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => onChange({ useCurrentTime: false, inputValue: toLocalInputValue(new Date()) })}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="stack stack--sm">
      <label className="visually-hidden" htmlFor={inputId}>
        Date and time of the urge
      </label>
      <input
        id={inputId}
        className="input"
        type="datetime-local"
        value={value.inputValue}
        max={latestAllowed}
        onChange={(event) => onChange({ useCurrentTime: false, inputValue: event.target.value })}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
      />
      <div className="row row--between row--wrap">
        <span className="text-small text-muted">
          {value.inputValue ? formatDateTime(value.inputValue) : "Pick a date and time"}
        </span>
        <button type="button" className="link-btn text-small" onClick={() => onChange({ useCurrentTime: true, inputValue: "" })}>
          Use the current time
        </button>
      </div>
    </div>
  );
}

/** Optional 1–10 intensity. Tap a number to choose it; "Clear" removes it. */
export function IntensityScale({ value, onChange }) {
  const name = useId();
  const levels = [];
  for (let level = INTENSITY_MIN; level <= INTENSITY_MAX; level += 1) levels.push(level);

  return (
    <div className="stack stack--sm">
      <div className="scale" role="radiogroup" aria-label="Urge intensity from 1, very mild, to 10, extremely strong">
        {levels.map((level) => (
          <label key={level} className="scale__option">
            <input type="radio" name={name} checked={value === level} onChange={() => onChange(level)} />
            <span className="scale__face">{level}</span>
          </label>
        ))}
      </div>
      <div className="row row--between">
        <span className="text-xs text-muted">1 = very mild · 10 = extremely strong</span>
        {value !== null ? (
          <button type="button" className="link-btn text-small" onClick={() => onChange(null)}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** One of the four outcomes; "Not recorded" (null) is a real, valid choice. */
export function OutcomePicker({ value, onChange }) {
  const name = useId();
  return (
    <div className="outcome-list" role="radiogroup" aria-label="Response to the urge">
      {OUTCOME_OPTIONS.map((option) => (
        <label key={String(option.value)} className="outcome-option">
          <input type="radio" name={name} checked={(value ?? null) === option.value} onChange={() => onChange(option.value)} />
          <span className="outcome-option__face">
            <span className="outcome-option__radio" aria-hidden="true" />
            <span className="stack stack--xs">
              <span className="text-strong">{option.label}</span>
              <span className="text-small text-secondary">{option.description}</span>
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * Multi-select chips for a named list (context tags or coping strategies),
 * with an inline "add your own" input.
 *
 * `onCreate(name)` must save the new item and return it ({ id, name }).
 */
export function NamedChoiceList({ label, items, selectedIds, onChange, onCreate, addLabel, placeholder }) {
  const [isAdding, setIsAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState("");
  const inputId = useId();

  const toggle = (itemId, isChecked) =>
    onChange(isChecked ? [...selectedIds, itemId] : selectedIds.filter((id) => id !== itemId));

  async function addItem() {
    if (!draftName.trim()) {
      setIsAdding(false);
      return;
    }
    try {
      const item = await onCreate(draftName);
      if (!selectedIds.includes(item.id)) onChange([...selectedIds, item.id]);
      setDraftName("");
      setError("");
      setIsAdding(false);
    } catch (caught) {
      setError(describeError(caught));
    }
  }

  return (
    <div className="stack stack--sm">
      <div className="choice-list" role="group" aria-label={label}>
        {items.map((item) => (
          <ChoiceChip
            key={item.id}
            label={item.name}
            checked={selectedIds.includes(item.id)}
            onChange={(isChecked) => toggle(item.id, isChecked)}
          />
        ))}
        {!isAdding ? (
          <button type="button" className="add-chip" onClick={() => setIsAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            {addLabel}
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <div className="stack stack--xs">
          <div className="row">
            <label className="visually-hidden" htmlFor={inputId}>
              {addLabel}
            </label>
            <input
              id={inputId}
              className="input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              // This input sits inside the big entry form. Without this,
              // pressing Enter here would submit the whole entry.
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addItem();
                }
              }}
              maxLength={NAMED_ITEM_MAX_LENGTH}
              placeholder={placeholder}
              autoComplete="off"
              enterKeyHint="done"
              autoFocus
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={addItem}>
              Add
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cancel adding"
              onClick={() => {
                setIsAdding(false);
                setDraftName("");
                setError("");
              }}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
