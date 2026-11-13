import { useId, useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { REFLECTION_PROMPTS } from "../../data/defaults.js";
import { describeError } from "../../db/errors.js";
import { TEXT_FIELD_MAX_LENGTH, updateEntry } from "../../db/entriesRepository.js";
import { updateSettings } from "../../db/settingsRepository.js";

/**
 * A short, optional reflection offered right after an urge is saved.
 * The entry is already stored when this appears – closing or skipping loses
 * nothing. An answer, if given, is saved onto the same entry.
 */
export default function ReflectionSheet({ entry, onDone }) {
  const showToast = useToast();
  const textareaId = useId();
  // The function form of useState runs once, so the prompt does not change
  // every time the component re-renders.
  const [prompt] = useState(() => REFLECTION_PROMPTS[Math.floor(Math.random() * REFLECTION_PROMPTS.length)]);
  const [response, setResponse] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveReflection() {
    if (!response.trim()) return onDone();
    setIsSaving(true);
    try {
      await updateEntry(entry.id, { reflectionPrompt: prompt, reflectionResponse: response });
      showToast("Reflection saved.");
      onDone();
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
      setIsSaving(false);
    }
  }

  async function turnOffPrompts() {
    await updateSettings({ reflectionPromptsEnabled: false }).catch(() => {});
    showToast("Reflection prompts turned off. You can turn them back on in Settings.");
    onDone();
  }

  return (
    <Modal
      isOpen
      onClose={onDone}
      title="Saved. A moment to reflect?"
      footer={
        <>
          <button type="button" className="btn btn--primary" onClick={saveReflection} disabled={isSaving}>
            {response.trim() ? "Save reflection" : "Done"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onDone} data-autofocus>
            Skip
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="reflection-prompt" htmlFor={textareaId}>
          {prompt}
        </label>
        <textarea
          id={textareaId}
          className="textarea"
          rows={3}
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          maxLength={TEXT_FIELD_MAX_LENGTH}
          placeholder="Optional – a few words are enough"
        />
        <button type="button" className="link-btn text-small text-muted" onClick={turnOffPrompts}>
          Don't show reflection prompts
        </button>
      </div>
    </Modal>
  );
}
