/**
 * Small reusable form controls.
 *
 * Each one is built on a real <input> (radio or checkbox) that is visually
 * replaced by a styled "face". Using native inputs means keyboard support,
 * screen-reader announcements and form behaviour come for free.
 */
import { useId } from "react";
import { Check, CircleAlert } from "lucide-react";

/** Pick exactly one of a few short options, e.g. Day | Week. */
export function SegmentedControl({ label, options, value, onChange, block = false }) {
  const name = useId();
  return (
    <div className={`segmented ${block ? "segmented--block" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={String(option.value)} className="segmented__option">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className="segmented__face">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

/** A pill-shaped checkbox, used for tags and coping strategies. */
export function ChoiceChip({ label, checked, onChange, type = "checkbox", name }) {
  return (
    <label className="choice">
      <input type={type} name={name} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="choice__face">
        <Check className="choice__check" size={16} aria-hidden="true" />
        {label}
      </span>
    </label>
  );
}

/** An on/off setting with a title and an optional explanation. */
export function Switch({ label, description, checked, onChange }) {
  return (
    <label className="switch">
      <span className="switch__text">
        <span className="text-strong">{label}</span>
        {description ? <span className="text-small text-muted">{description}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

/** Red message under a field. role="alert" makes screen readers read it out. */
export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="field__error" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      {children}
    </p>
  );
}
