/**
 * EntryForm – the form behind both "Log an urge" and "Edit entry".
 *
 * Required: habit, at least one emotion, date/time (defaults to now).
 * Everything else is optional and tucked into a collapsible section so the
 * quick path stays quick: pick habit → pick emotions → Save.
 *
 * State lives here with `useState`; the small controls in formControls.jsx
 * just display values and report changes back.
 */
import { useId, useRef, useState } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import EmotionPicker from "../../components/emotions/EmotionPicker.jsx";
import { FieldError } from "../../components/ui/controls.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { describeError, ValidationError } from "../../db/errors.js";
import { TEXT_FIELD_MAX_LENGTH, createEntry, updateEntry } from "../../db/entriesRepository.js";
import { contextTagsRepository, copingStrategiesRepository } from "../../db/namedListRepository.js";
import { updateSettings } from "../../db/settingsRepository.js";
import { fromLocalInputValue, nowIso, toLocalInputValue } from "../../utils/dates.js";
import { HabitPicker, IntensityScale, NamedChoiceList, OutcomePicker, TimestampField } from "./formControls.jsx";

/**
 * Props:
 *   entry             the entry being edited, or undefined for a new one
 *   habits            habits that may be chosen
 *   contextTags, copingStrategies   the user's lists
 *   initialHabitId    pre-select a habit (e.g. coming from a habit's page)
 *   detailsInitiallyOpen  whether the optional section starts expanded
 *   onSaved(entry, { isNew })
 *   onCancel          shown as a button when provided
 */
export default function EntryForm({
  entry,
  habits,
  contextTags,
  copingStrategies,
  initialHabitId,
  detailsInitiallyOpen = false,
  onSaved,
  onCancel,
}) {
  const isEditing = Boolean(entry);
  const formId = useId();
  const showToast = useToast();

  // With a single habit there is nothing to choose, so pre-select it.
  const defaultHabitId = habits.some((habit) => habit.id === initialHabitId)
    ? initialHabitId
    : habits.length === 1
      ? habits[0].id
      : "";

  const [habitId, setHabitId] = useState(entry?.habitId ?? defaultHabitId);
  const [emotionIds, setEmotionIds] = useState(entry?.emotionIds ?? []);
  const [timestamp, setTimestamp] = useState(
    isEditing ? { useCurrentTime: false, inputValue: toLocalInputValue(entry.timestamp) } : { useCurrentTime: true, inputValue: "" },
  );
  const [intensity, setIntensity] = useState(entry?.intensity ?? null);
  const [situationalNotes, setSituationalNotes] = useState(entry?.situationalNotes ?? "");
  const [contextTagIds, setContextTagIds] = useState(entry?.contextTagIds ?? []);
  const [outcome, setOutcome] = useState(entry?.outcome ?? null);
  const [copingStrategyIds, setCopingStrategyIds] = useState(entry?.copingStrategyIds ?? []);
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const [isDetailsOpen, setIsDetailsOpen] = useState(isEditing || detailsInitiallyOpen);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Refs point at real DOM elements so we can scroll to the first problem.
  const habitSectionRef = useRef(null);
  const emotionSectionRef = useRef(null);
  const timeSectionRef = useRef(null);

  const detailCount =
    (intensity !== null ? 1 : 0) +
    (situationalNotes.trim() ? 1 : 0) +
    (contextTagIds.length > 0 ? 1 : 0) +
    (outcome !== null ? 1 : 0) +
    (copingStrategyIds.length > 0 ? 1 : 0) +
    (notes.trim() ? 1 : 0);

  function toggleDetails() {
    const next = !isDetailsOpen;
    setIsDetailsOpen(next);
    // Remember the preference for next time (new entries only).
    if (!isEditing) updateSettings({ logDetailsExpanded: next }).catch(() => {});
  }

  // Clear a field's error as soon as the user fixes it.
  const clearError = (field) => setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    const fields = {
      habitId,
      emotionIds,
      // "Now" is read at the moment of saving, not when the form was opened.
      timestamp: timestamp.useCurrentTime ? nowIso() : fromLocalInputValue(timestamp.inputValue),
      intensity,
      situationalNotes,
      contextTagIds,
      outcome,
      copingStrategyIds,
      notes,
    };

    try {
      const saved = isEditing ? await updateEntry(entry.id, fields) : await createEntry(fields);
      onSaved(saved, { isNew: !isEditing });
    } catch (error) {
      setIsSaving(false);
      if (error instanceof ValidationError) {
        setFieldErrors(error.fieldErrors);
        const firstInvalid = error.fieldErrors.habitId
          ? habitSectionRef
          : error.fieldErrors.emotionIds
            ? emotionSectionRef
            : error.fieldErrors.timestamp
              ? timeSectionRef
              : null;
        if (firstInvalid?.current) {
          firstInvalid.current.scrollIntoView({ behavior: "smooth", block: "start" });
          firstInvalid.current.focus({ preventScroll: true });
        } else {
          setIsDetailsOpen(true);
        }
      } else {
        showToast(describeError(error), { tone: "error" });
      }
    }
  }

  const errorMessages = Object.values(fieldErrors).filter(Boolean);

  return (
    <form className="entry-form" onSubmit={handleSubmit} noValidate>
      {/* ---------- Habit ---------- */}
      <section ref={habitSectionRef} className="form-section" tabIndex={-1} aria-labelledby={`${formId}-habit`}>
        <h2 id={`${formId}-habit`} className="form-section__title">
          Which habit?
        </h2>
        <HabitPicker
          habits={habits}
          value={habitId}
          onChange={(nextHabitId) => {
            setHabitId(nextHabitId);
            clearError("habitId");
          }}
          describedBy={fieldErrors.habitId ? `${formId}-habit-error` : undefined}
        />
        <FieldError id={`${formId}-habit-error`}>{fieldErrors.habitId}</FieldError>
      </section>

      {/* ---------- Emotions ---------- */}
      <section ref={emotionSectionRef} className="form-section" tabIndex={-1} aria-labelledby={`${formId}-emotions`}>
        <div className="stack stack--xs">
          <h2 id={`${formId}-emotions`} className="form-section__title">
            What are you feeling?
          </h2>
          <p className="text-small text-secondary">Choose as many as fit, from any category.</p>
        </div>
        <EmotionPicker
          selectedIds={emotionIds}
          onChange={(nextIds) => {
            setEmotionIds(nextIds);
            clearError("emotionIds");
          }}
        />
        <FieldError id={`${formId}-emotions-error`}>{fieldErrors.emotionIds}</FieldError>
      </section>

      {/* ---------- When ---------- */}
      <section ref={timeSectionRef} className="form-section" tabIndex={-1} aria-labelledby={`${formId}-when`}>
        <h2 id={`${formId}-when`} className="form-section__title">
          When?
        </h2>
        <TimestampField
          value={timestamp}
          onChange={(next) => {
            setTimestamp(next);
            clearError("timestamp");
          }}
          hasError={Boolean(fieldErrors.timestamp)}
          errorId={`${formId}-when-error`}
        />
        <FieldError id={`${formId}-when-error`}>{fieldErrors.timestamp}</FieldError>
      </section>

      {/* ---------- Optional details ---------- */}
      <section className="form-section form-section--flush">
        <h2 className="form-section__toggle-heading">
          <button
            type="button"
            className="details-toggle"
            aria-expanded={isDetailsOpen}
            aria-controls={`${formId}-details`}
            onClick={toggleDetails}
          >
            <span className="stack stack--xs">
              <span className="form-section__title">Add details</span>
              <span className="text-small text-muted">
                {detailCount > 0 ? `${detailCount} added · all optional` : "Optional – intensity, context, outcome, notes"}
              </span>
            </span>
            <ChevronDown size={22} aria-hidden="true" />
          </button>
        </h2>

        {isDetailsOpen ? (
          <div id={`${formId}-details`} className="details-body">
            <fieldset className="field">
              <legend className="field__label">Urge intensity</legend>
              <IntensityScale value={intensity} onChange={setIntensity} />
              <FieldError>{fieldErrors.intensity}</FieldError>
            </fieldset>

            <div className="field">
              <label className="field__label" htmlFor={`${formId}-situation`}>
                What was happening?
              </label>
              <textarea
                id={`${formId}-situation`}
                className="textarea"
                rows={2}
                value={situationalNotes}
                onChange={(event) => setSituationalNotes(event.target.value)}
                maxLength={TEXT_FIELD_MAX_LENGTH}
                placeholder="e.g. Just got home from work"
              />
            </div>

            <fieldset className="field">
              <legend className="field__label">Context</legend>
              <NamedChoiceList
                label="Context tags"
                items={contextTags}
                selectedIds={contextTagIds}
                onChange={setContextTagIds}
                onCreate={(name) => contextTagsRepository.create(name)}
                addLabel="New tag"
                placeholder="e.g. On the train"
              />
            </fieldset>

            <fieldset className="field">
              <legend className="field__label">Response to the urge</legend>
              <OutcomePicker value={outcome} onChange={setOutcome} />
              <FieldError>{fieldErrors.outcome}</FieldError>
            </fieldset>

            <fieldset className="field">
              <legend className="field__label">Coping strategies tried</legend>
              <NamedChoiceList
                label="Coping strategies"
                items={copingStrategies}
                selectedIds={copingStrategyIds}
                onChange={setCopingStrategyIds}
                onCreate={(name) => copingStrategiesRepository.create(name)}
                addLabel="Custom strategy"
                placeholder="e.g. Cold shower"
              />
            </fieldset>

            <div className="field">
              <label className="field__label" htmlFor={`${formId}-notes`}>
                Notes
              </label>
              <textarea
                id={`${formId}-notes`}
                className="textarea"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={TEXT_FIELD_MAX_LENGTH}
                placeholder="Anything else you want to remember"
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* ---------- Save bar (stays visible while scrolling) ---------- */}
      <div className="save-bar">
        {errorMessages.length > 0 ? (
          <p className="save-bar__error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {errorMessages.length === 1 ? errorMessages[0] : "A few things need attention above."}
          </p>
        ) : null}
        <div className="row">
          {onCancel ? (
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="btn btn--primary grow" disabled={isSaving}>
            {isEditing ? "Save changes" : "Save entry"}
          </button>
        </div>
      </div>
    </form>
  );
}
