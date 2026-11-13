/**
 * Add, rename and delete items of a named list – used twice on the Settings
 * page: once for context tags, once for coping strategies.
 */
import { useId, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { describeError } from "../../db/errors.js";
import { NAMED_ITEM_MAX_LENGTH } from "../../db/namedListRepository.js";
import { pluralize } from "../../utils/text.js";

/**
 * @param {Array}  items       [{ id, name }]
 * @param {object} repository  contextTagsRepository or copingStrategiesRepository
 * @param {string} noun        "tag" | "strategy" – used in button labels
 */
export default function ManageNamedList({ items, repository, noun, addPlaceholder }) {
  const showToast = useToast();
  const inputId = useId();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name } while renaming
  const [pendingDelete, setPendingDelete] = useState(null); // { item, usageCount }

  async function handleAdd(event) {
    event.preventDefault();
    if (!newName.trim()) return;
    try {
      const existingIds = new Set(items.map((item) => item.id));
      const item = await repository.create(newName);
      showToast(existingIds.has(item.id) ? `“${item.name}” already exists.` : `“${item.name}” added.`);
      setNewName("");
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  async function handleRename(event) {
    event.preventDefault();
    try {
      await repository.rename(editing.id, editing.name);
      setEditing(null);
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  async function askToDelete(item) {
    // Look up how many entries use it, so the confirmation can say so.
    setPendingDelete({ item, usageCount: await repository.countUsage(item.id) });
  }

  async function handleDeleteConfirmed() {
    try {
      await repository.remove(pendingDelete.item.id);
      showToast(`“${pendingDelete.item.name}” deleted.`);
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
    setPendingDelete(null);
  }

  return (
    <div className="stack stack--md">
      <ul className="settings-list">
        {items.map((item) =>
          editing?.id === item.id ? (
            <li key={item.id}>
              <form className="settings-list__row" onSubmit={handleRename}>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  maxLength={NAMED_ITEM_MAX_LENGTH}
                  aria-label={`New name for ${item.name}`}
                  autoFocus
                />
                <button type="submit" className="icon-btn" aria-label="Save name">
                  <Check size={20} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" aria-label="Cancel renaming" onClick={() => setEditing(null)}>
                  <X size={20} aria-hidden="true" />
                </button>
              </form>
            </li>
          ) : (
            <li key={item.id} className="settings-list__row">
              <span className="grow">{item.name}</span>
              <button type="button" className="icon-btn" aria-label={`Rename ${item.name}`} onClick={() => setEditing({ id: item.id, name: item.name })}>
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button type="button" className="icon-btn" aria-label={`Delete ${item.name}`} onClick={() => askToDelete(item)}>
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          ),
        )}
      </ul>

      <form className="row" onSubmit={handleAdd}>
        <label className="visually-hidden" htmlFor={inputId}>
          New {noun}
        </label>
        <input
          id={inputId}
          className="input"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          maxLength={NAMED_ITEM_MAX_LENGTH}
          placeholder={addPlaceholder}
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit" className="btn btn--secondary btn--sm" disabled={!newName.trim()}>
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </form>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.item.name ?? ""}”?`}
        tone="danger"
        confirmLabel={`Delete ${noun}`}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setPendingDelete(null)}
      >
        {pendingDelete ? (
          <p>
            {pendingDelete.usageCount > 0
              ? `It will be removed from ${pluralize(pendingDelete.usageCount, "entry", "entries")}. The entries themselves are kept.`
              : "No entries use it, so nothing else changes."}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
