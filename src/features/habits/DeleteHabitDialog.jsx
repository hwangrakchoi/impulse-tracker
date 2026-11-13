import { useEffect, useState } from "react";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { describeError } from "../../db/errors.js";
import { countEntriesForHabit, deleteHabit, setHabitArchived } from "../../db/habitsRepository.js";
import { pluralize } from "../../utils/text.js";

/**
 * Asks before deleting a habit.
 *
 * If the habit has logged urges, deleting it would erase that history too, so
 * the dialog spells that out and makes "Archive instead" the main button.
 */
export default function DeleteHabitDialog({ habit, onClose, onDeleted }) {
  const showToast = useToast();
  const [entryCount, setEntryCount] = useState(null); // null = still counting
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    countEntriesForHabit(habit.id).then((count) => {
      if (isCurrent) setEntryCount(count);
    });
    // If the dialog closes before the count arrives, ignore the late answer.
    return () => {
      isCurrent = false;
    };
  }, [habit.id]);

  async function run(action, successMessage) {
    setIsBusy(true);
    try {
      await action();
      showToast(successMessage);
      onClose();
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
      setIsBusy(false);
    }
  }

  const handleDelete = () =>
    run(async () => {
      await deleteHabit(habit.id);
      onDeleted?.();
    }, `“${habit.name}” deleted.`);

  const handleArchive = () => run(() => setHabitArchived(habit.id, true), `“${habit.name}” archived.`);

  const hasHistory = entryCount > 0;
  const canArchive = hasHistory && !habit.isArchived;

  return (
    <ConfirmDialog
      isOpen={entryCount !== null}
      title={`Delete “${habit.name}”?`}
      tone="danger"
      confirmLabel={hasHistory ? `Delete habit and ${pluralize(entryCount, "entry", "entries")}` : "Delete habit"}
      isBusy={isBusy}
      onConfirm={handleDelete}
      onCancel={onClose}
      secondaryAction={canArchive ? { label: "Archive instead", onClick: handleArchive } : undefined}
    >
      {hasHistory ? (
        <>
          <p>
            This habit has <strong>{pluralize(entryCount, "logged urge")}</strong>. Deleting it permanently removes the
            habit <strong>and all of those entries</strong> from this device. They will disappear from History and from
            your analytics, and this can't be undone.
          </p>
          {canArchive ? (
            <p>
              <strong>Archiving</strong> is the safer choice: the habit is hidden from the Log screen, but its history
              and analytics stay, and you can reactivate it at any time.
            </p>
          ) : (
            <p>This habit is already archived, so it is hidden from the Log screen while its history is kept.</p>
          )}
        </>
      ) : (
        <p>This habit has no logged urges, so nothing else will be removed.</p>
      )}
    </ConfirmDialog>
  );
}
