/**
 * First-run welcome. Explains what the app is in three lines and offers a few
 * example habits. Nothing is created unless the user picks or types one, and
 * the whole step can be skipped.
 */
import { useState } from "react";
import { HardDrive, HeartHandshake, Stethoscope } from "lucide-react";
import { ChoiceChip } from "../../components/ui/controls.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { HABIT_SUGGESTIONS } from "../../data/defaults.js";
import { describeError } from "../../db/errors.js";
import { HABIT_NAME_MAX_LENGTH, createHabit } from "../../db/habitsRepository.js";
import { updateSettings } from "../../db/settingsRepository.js";
import { cleanName, nameKey } from "../../utils/text.js";

export default function Onboarding() {
  const showToast = useToast();
  const [selectedNames, setSelectedNames] = useState([]);
  const [customName, setCustomName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleSuggestion = (name, isChecked) =>
    setSelectedNames((current) => (isChecked ? [...current, name] : current.filter((item) => item !== name)));

  const custom = cleanName(customName);
  const chosenCount = selectedNames.length + (custom ? 1 : 0);

  async function finish({ createSelected }) {
    setIsSaving(true);
    try {
      if (createSelected) {
        const suggestions = HABIT_SUGGESTIONS.filter((suggestion) => selectedNames.includes(suggestion.name));
        for (const suggestion of suggestions) {
          await createHabit(suggestion);
        }
        // Skip the custom name if it repeats a suggestion that was just added.
        if (custom && !suggestions.some((suggestion) => nameKey(suggestion.name) === nameKey(custom))) {
          await createHabit({ name: custom });
        }
      }
      await updateSettings({ onboardingComplete: true });
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
      setIsSaving(false);
    }
  }

  return (
    <section className="card onboarding" aria-labelledby="onboarding-title">
      <div className="stack stack--sm">
        <h1 id="onboarding-title">Welcome</h1>
        <p className="text-secondary">
          This is a quiet place to notice which emotions show up before an urge. You observe; the app keeps track.
        </p>
      </div>

      <ul className="onboarding__points">
        <li className="onboarding__point">
          <HeartHandshake size={20} aria-hidden="true" />
          <span>
            <strong>No judgment.</strong> Logging an urge – whatever happened next – is the whole point.
          </span>
        </li>
        <li className="onboarding__point">
          <HardDrive size={20} aria-hidden="true" />
          <span>
            <strong>Private by design.</strong> Everything stays on this device. No account, no cloud, no tracking.
          </span>
        </li>
        <li className="onboarding__point">
          <Stethoscope size={20} aria-hidden="true" />
          <span>
            <strong>Not a medical tool.</strong> It can't diagnose or treat anything. If you're struggling, a doctor,
            therapist or local helpline can help.
          </span>
        </li>
      </ul>

      <fieldset className="field">
        <legend className="field__label">What would you like to keep an eye on?</legend>
        <p className="field__hint">Pick any that apply, add your own, or skip – you can change this later.</p>
        <div className="choice-list">
          {HABIT_SUGGESTIONS.map((suggestion) => (
            <ChoiceChip
              key={suggestion.name}
              label={suggestion.name}
              checked={selectedNames.includes(suggestion.name)}
              onChange={(isChecked) => toggleSuggestion(suggestion.name, isChecked)}
            />
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor="onboarding-custom">
          Something else <span className="field__optional">(optional)</span>
        </label>
        <input
          id="onboarding-custom"
          className="input"
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
          maxLength={HABIT_NAME_MAX_LENGTH}
          placeholder="Name your own habit"
          autoComplete="off"
        />
      </div>

      <div className="stack stack--sm">
        <button type="button" className="btn btn--primary btn--block" disabled={isSaving || chosenCount === 0} onClick={() => finish({ createSelected: true })}>
          {chosenCount > 0 ? `Add ${chosenCount} ${chosenCount === 1 ? "habit" : "habits"} and continue` : "Choose a habit to continue"}
        </button>
        <button type="button" className="btn btn--ghost btn--block" disabled={isSaving} onClick={() => finish({ createSelected: false })}>
          Skip for now
        </button>
      </div>
    </section>
  );
}
