/**
 * Habits page – create, edit, archive, reactivate and delete habits.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Archive, ArchiveRestore, ChartColumn, ChevronRight, Ellipsis, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "../components/ui/Modal.jsx";
import { EmptyState, HabitIcon, PageHeader } from "../components/ui/display.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { describeError } from "../db/errors.js";
import { setHabitArchived } from "../db/habitsRepository.js";
import DeleteHabitDialog from "../features/habits/DeleteHabitDialog.jsx";
import HabitFormModal from "../features/habits/HabitFormModal.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { groupBy } from "../services/analytics.js";
import { formatRelativeTime } from "../utils/dates.js";
import { pluralize } from "../utils/text.js";

export default function HabitsPage() {
  const { habits, entries, isLoading } = useAppData();
  const showToast = useToast();
  const navigate = useNavigate();

  // Which dialog is open. `null` = none. Keeping this in ONE state value
  // guarantees two dialogs can never be open at the same time.
  //   { type: "form", habit }    – habit is null when creating
  //   { type: "actions", habit }
  //   { type: "delete", habit }
  const [dialog, setDialog] = useState(null);
  const closeDialog = () => setDialog(null);

  const entriesByHabit = useMemo(() => groupBy(entries, (entry) => entry.habitId), [entries]);
  const activeHabits = habits.filter((habit) => !habit.isArchived);
  const archivedHabits = habits.filter((habit) => habit.isArchived);

  async function toggleArchived(habit) {
    try {
      await setHabitArchived(habit.id, !habit.isArchived);
      showToast(habit.isArchived ? `“${habit.name}” reactivated.` : `“${habit.name}” archived. Its history is kept.`);
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
    closeDialog();
  }

  const renderHabit = (habit) => {
    const habitEntries = entriesByHabit.get(habit.id) ?? [];
    // Entries arrive newest-first, so the first one is the latest.
    const summary =
      habitEntries.length === 0
        ? "No urges logged yet"
        : `${pluralize(habitEntries.length, "urge")} logged · last ${formatRelativeTime(habitEntries[0].timestamp)}`;
    return (
      <li key={habit.id} className="card habit-row">
        <Link to={`/habits/${habit.id}`} className="habit-row__main" aria-label={`${habit.name}: view details`}>
          <HabitIcon habit={habit} />
          <span className="habit-row__text">
            <span className="habit-row__name">{habit.name}</span>
            {habit.description ? <span className="text-small text-secondary truncate">{habit.description}</span> : null}
            <span className="text-xs text-muted">{summary}</span>
          </span>
          <ChevronRight size={20} className="text-muted" aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Actions for ${habit.name}`}
          onClick={() => setDialog({ type: "actions", habit })}
        >
          <Ellipsis size={22} aria-hidden="true" />
        </button>
      </li>
    );
  };

  const actionHabit = dialog?.type === "actions" ? dialog.habit : null;

  return (
    <div className="page">
      <PageHeader
        title="Habits"
        subtitle="The habits you want to keep an eye on."
        actions={
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setDialog({ type: "form", habit: null })}>
            <Plus size={18} aria-hidden="true" />
            New habit
          </button>
        }
      />

      {isLoading ? null : habits.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ListChecks}
            title="No habits yet"
            action={
              <button type="button" className="btn btn--primary" onClick={() => setDialog({ type: "form", habit: null })}>
                <Plus size={18} aria-hidden="true" />
                Add your first habit
              </button>
            }
          >
            Add a habit you'd like to understand better – for example alcohol, vaping or social media. You choose what
            to track.
          </EmptyState>
        </div>
      ) : (
        <>
          <section className="stack stack--md" aria-labelledby="active-habits-title">
            <h2 id="active-habits-title" className="section-title">
              Active
            </h2>
            {activeHabits.length > 0 ? (
              <ul className="stack stack--md">{activeHabits.map(renderHabit)}</ul>
            ) : (
              <p className="text-secondary">All of your habits are archived. Reactivate one below or add a new one.</p>
            )}
          </section>

          {archivedHabits.length > 0 ? (
            <section className="stack stack--md" aria-labelledby="archived-habits-title">
              <div className="stack stack--xs">
                <h2 id="archived-habits-title" className="section-title">
                  Archived
                </h2>
                <p className="text-small text-muted">
                  Hidden from the Log screen. Their history still appears in History and analytics.
                </p>
              </div>
              <ul className="stack stack--md">{archivedHabits.map(renderHabit)}</ul>
            </section>
          ) : null}
        </>
      )}

      {/* --- Action sheet for one habit --- */}
      <Modal isOpen={Boolean(actionHabit)} onClose={closeDialog} title={actionHabit?.name ?? ""}>
        {actionHabit ? (
          <ul className="action-list">
            {!actionHabit.isArchived ? (
              <li>
                <button type="button" className="action-list__item" onClick={() => navigate(`/log?habit=${actionHabit.id}`)}>
                  <Plus size={20} aria-hidden="true" />
                  Log an urge
                </button>
              </li>
            ) : null}
            <li>
              <button type="button" className="action-list__item" onClick={() => navigate(`/habits/${actionHabit.id}`)}>
                <ChartColumn size={20} aria-hidden="true" />
                View details
              </button>
            </li>
            <li>
              <button type="button" className="action-list__item" onClick={() => setDialog({ type: "form", habit: actionHabit })}>
                <Pencil size={20} aria-hidden="true" />
                Edit
              </button>
            </li>
            <li>
              <button type="button" className="action-list__item" onClick={() => toggleArchived(actionHabit)}>
                {actionHabit.isArchived ? <ArchiveRestore size={20} aria-hidden="true" /> : <Archive size={20} aria-hidden="true" />}
                {actionHabit.isArchived ? "Reactivate" : "Archive (keeps history)"}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="action-list__item action-list__item--danger"
                onClick={() => setDialog({ type: "delete", habit: actionHabit })}
              >
                <Trash2 size={20} aria-hidden="true" />
                Delete…
              </button>
            </li>
          </ul>
        ) : null}
      </Modal>

      {dialog?.type === "form" ? (
        // `key` makes React create a fresh form (with fresh state) per habit.
        <HabitFormModal key={dialog.habit?.id ?? "new"} habit={dialog.habit} onClose={closeDialog} />
      ) : null}

      {dialog?.type === "delete" ? <DeleteHabitDialog habit={dialog.habit} onClose={closeDialog} /> : null}
    </div>
  );
}
