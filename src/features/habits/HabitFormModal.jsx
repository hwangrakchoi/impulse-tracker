/**
 * The "New habit" / "Edit habit" dialog.
 *
 * The form keeps its fields in React state while the user types (`useState`)
 * and only writes to the database when Save is pressed. Validation lives in
 * the repository; this component just displays the messages it returns.
 */
import { useId, useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { FieldError } from "../../components/ui/controls.jsx";
import { HabitIcon } from "../../components/ui/display.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON, HABIT_COLOR_CHOICES } from "../../data/defaults.js";
import { HABIT_ICONS } from "../../data/habitIcons.js";
import { describeError, ValidationError } from "../../db/errors.js";
import {
  HABIT_DESCRIPTION_MAX_LENGTH,
  HABIT_NAME_MAX_LENGTH,
  createHabit,
  updateHabit,
} from "../../db/habitsRepository.js";

/**
 * @param {object|null} habit  the habit to edit, or null to create a new one
 */
export default function HabitFormModal({ habit, onClose, onSaved }) {
  const isEditing = Boolean(habit);
  const formId = useId();
  const showToast = useToast();

  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? DEFAULT_HABIT_ICON);
  const [accentColor, setAccentColor] = useState(habit?.accentColor ?? DEFAULT_HABIT_COLOR);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const isPresetColor = HABIT_COLOR_CHOICES.some((choice) => choice.value === accentColor);

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser's default full-page form submit
    setIsSaving(true);
    try {
      const fields = { name, description, icon, accentColor };
      const saved = isEditing ? await updateHabit(habit.id, fields) : await createHabit(fields);
      showToast(isEditing ? "Habit updated." : `“${saved.name}” added.`);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ValidationError) {
        setFieldErrors(error.fieldErrors);
      } else {
        showToast(describeError(error), { tone: "error" });
      }
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? "Edit habit" : "New habit"}
      footer={
        <>
          <button type="submit" form={formId} className="btn btn--primary" disabled={isSaving}>
            {isEditing ? "Save changes" : "Add habit"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <form id={formId} className="stack" onSubmit={handleSubmit} noValidate>
        <div className="row row--top">
          <HabitIcon habit={{ icon, accentColor }} size="lg" />
          <div className="field grow">
            <label className="field__label" htmlFor={`${formId}-name`}>
              Name
            </label>
            <input
              id={`${formId}-name`}
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={HABIT_NAME_MAX_LENGTH}
              placeholder="e.g. Alcohol"
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? `${formId}-name-error` : undefined}
              data-autofocus
            />
            <FieldError id={`${formId}-name-error`}>{fieldErrors.name}</FieldError>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${formId}-description`}>
            Description <span className="field__optional">(optional)</span>
          </label>
          <textarea
            id={`${formId}-description`}
            className="textarea"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={HABIT_DESCRIPTION_MAX_LENGTH}
            placeholder="Anything that helps you recognise it"
            aria-invalid={Boolean(fieldErrors.description)}
          />
          <FieldError>{fieldErrors.description}</FieldError>
        </div>

        <fieldset className="field">
          <legend className="field__label">Icon</legend>
          <div className="icon-choice-grid">
            {HABIT_ICONS.map(({ key, label, Icon }) => (
              <label key={key} className="icon-choice">
                <input type="radio" name={`${formId}-icon`} checked={icon === key} onChange={() => setIcon(key)} />
                <span className="icon-choice__face">
                  <Icon size={22} aria-hidden="true" />
                  <span className="visually-hidden">{label}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Accent color</legend>
          <div className="color-choice-row">
            {HABIT_COLOR_CHOICES.map((choice) => (
              <label key={choice.value} className="color-choice">
                <input
                  type="radio"
                  name={`${formId}-color`}
                  checked={accentColor === choice.value}
                  onChange={() => setAccentColor(choice.value)}
                />
                <span className="color-choice__face" style={{ "--swatch": choice.value }}>
                  <span className="visually-hidden">{choice.name}</span>
                </span>
              </label>
            ))}
            {/* The browser's own color picker, for any other color. */}
            <label className="color-choice color-choice--custom" data-active={!isPresetColor}>
              <input
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
                aria-label="Custom color"
              />
              <span className="color-choice__face" style={{ "--swatch": isPresetColor ? "transparent" : accentColor }}>
                {isPresetColor ? <span aria-hidden="true">+</span> : null}
              </span>
            </label>
          </div>
          <p className="field__hint">Used for this habit's icon and its trend chart.</p>
        </fieldset>
      </form>
    </Modal>
  );
}
